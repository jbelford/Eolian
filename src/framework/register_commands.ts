import { ContextMenuCommandBuilder, SlashCommandBuilder, SlashCommandStringOption } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { checkSetKeyword, COMMANDS, getCommand, getMessageCommand, MESSAGE_COMMANDS, patternMatch, simpleOptionsStrategy } from 'commands';
import { Command, CommandArgs, CommandOptions, Keyword, KeywordGroup, MessageCommand, ParsedCommand, Pattern, SyntaxType } from 'commands/@types';
import { KEYWORDS, KEYWORD_GROUPS } from 'commands/keywords';
import { PATTERNS, PATTERNS_SORTED } from 'commands/patterns';
import { PERMISSION } from 'common/constants';
import { environment } from 'common/env';
import { EolianUserError } from 'common/errors';
import { logger } from 'common/logger';
import { ApplicationCommandType, Routes } from 'discord-api-types/v9';
import { CommandInteraction } from 'discord.js';

export async function registerGlobalSlashCommands(): Promise<boolean> {
  if (!environment.tokens.discord.clientId) {
    logger.info('Missing client id. Not registering slash commands');
    return false;
  }

  logger.info('Sending refresh for global slash commands');
  return registerSlashCommands(Routes.applicationCommands(environment.tokens.discord.clientId));
}

export async function registerGuildSlashCommands(guildId: string): Promise<boolean> {
  if (!environment.tokens.discord.clientId) {
    logger.info('Missing client id. Not registering slash commands');
    return false;
  }

  logger.info('Sending refresh for slash commands for guild %s', guildId);
  return registerSlashCommands(Routes.applicationGuildCommands(environment.tokens.discord.clientId, guildId));
}

async function registerSlashCommands(route: `/${string}`): Promise<boolean> {
  try {
    const rest = new REST({ version: '9' }).setToken(environment.tokens.discord.main);

    await rest.put(route, {
      body: COMMANDS.map(createSlashCommand).concat(MESSAGE_COMMANDS.map(createContextMenuCommand))
    });

    logger.info('Successfully refreshed slash commands.');

    return true;
  } catch (e) {
    logger.warn('Failed to refresh slash commands: %s', e);
  }
  return false;
}

function createSlashCommand(command: Command) {
  try {
    let description = command.shortDetails ?? command.details;
    if (description.length > 100) {
      logger.warn('"%s" description is greater than 100 and is clamped', command.name);
      description = description.slice(0, 100);
    }

    const builder = new SlashCommandBuilder()
      .setName(command.name)
      .setDescription(description);

    if (command.permission >= PERMISSION.OWNER) {
      builder.setDefaultPermission(false);
    }

    if (command.keywords || command.patterns) {
      const groupOption = new Map<KeywordGroup, SlashCommandStringOption>();
      command.patterns?.sort((a, b) => b.priority - a.priority).forEach(pattern => addPatternOption(builder, pattern, groupOption, command.args));
      command.keywords?.sort((a, b) => a.name.localeCompare(b.name)).forEach(keyword => addKeywordOption(builder, keyword, groupOption));
    } else if (command.args) {
      addCommandArgOptions(builder, command.args);
    } else {
      builder.addStringOption(option => option = option.setName('args')
          .setDescription(`Use "/help ${command.name}" to see arguments`)
          .setRequired(false));
    }

    return builder.toJSON();
  } catch (e) {
    logger.warn('Failed validation for %s', command);
    throw e;
  }
}

function addCommandArgOptions(builder: SlashCommandBuilder, args: CommandArgs) {
  for (const group of args.groups) {
    for (const option of group.options) {
      builder.addStringOption(optionBuilder => {
        optionBuilder.setName(option.name)
          .setDescription(option.details)
          .setRequired(false)
        if (option.getChoices) {
          const choices = option.getChoices();
          if (choices.length > 25) {
            logger.warn('Too many choices for %s option. Not adding choices.', option.name);
          } else {
            for (const choice of choices) {
              optionBuilder.addChoice(choice, choice);
            }
          }
        }
        return optionBuilder;
      });
    }
  }
}

function addKeywordOption(builder: SlashCommandBuilder, keyword: Keyword, groupOption: Map<KeywordGroup, SlashCommandStringOption>) {
  if (keyword.group) {
    const option = groupOption.get(keyword.group);
    if (option) {
      option.addChoice(keyword.name.toLowerCase(), keyword.name.toLowerCase());
    } else {
      const group = KEYWORD_GROUPS[keyword.group];
      builder.addStringOption(option => {
        option.setName(keyword.group!)
          .setDescription(group.details)
          .addChoice(keyword.name.toLowerCase(), keyword.name.toLowerCase());
        groupOption.set(keyword.group!, option);
        return option;
      });
    }
  } else {
    let details = keyword.details;
    if (details.length > 100) {
      logger.warn('"%s" description is greater than 100 and is clamped', keyword.name);
      details = details.slice(0, 100);
    }

    builder.addBooleanOption(option => option.setName(keyword.name.toLowerCase())
      .setDescription(details)
      .setRequired(false));
  }
}

function addPatternOption(builder: SlashCommandBuilder, pattern: Pattern, groupOption: Map<KeywordGroup, SlashCommandStringOption>, args?: CommandArgs) {
  if (args && pattern.name === PATTERNS.ARG.name) {
    addCommandArgOptions(builder, args);
  } else if (pattern.group) {
    if (!groupOption.has(pattern.group)) {
      const group = KEYWORD_GROUPS[pattern.group];
      builder.addStringOption(option => {
        option.setName(pattern.group!).setDescription(group.details);
        groupOption.set(pattern.group!, option);
        return option;
      });
    }
  } else {
    let details = pattern.details;
    if (details.length > 100) {
      logger.warn('"%s" description is greater than 100 and is clamped', pattern.name);
      details = details.slice(0, 100);
    }

    builder.addStringOption(option => option.setName(pattern.name.toLowerCase())
      .setDescription(details)
      .setRequired(false));
  }
}

function createContextMenuCommand(command: MessageCommand) {
  try {
    return new ContextMenuCommandBuilder()
      .setName(command.name)
      // @ts-ignore Discord.js doesn't play nice with types for some reason
      .setType(ApplicationCommandType.Message);
  } catch (e) {
    logger.warn('Failed validation for %s', command);
    throw e
  }
}

export function parseSlashCommand(interaction: CommandInteraction, permission: PERMISSION): ParsedCommand {
  const command = getCommand(interaction.commandName, permission);

  let options: CommandOptions = {};
  if (command.keywords || command.patterns) {
    const groupSet = new Set<string>();
    const patternSet = new Set<string>(command.patterns?.map(p => p.name));

    command.keywords?.forEach(keyword => parseSlashKeyword(keyword, permission, interaction, options, groupSet));
    command.patterns?.forEach(pattern => parseSlashPattern(pattern, permission, interaction, options, patternSet, groupSet, command.args));
  } else if (command.args) {
    options.ARG = parseCommandArgs(command.args, interaction);
  } else {
    options = simpleOptionsStrategy(interaction.options.getString('args', false) ?? '');
  }

  return { command, options };
}

function parseCommandArgs(commandArgs: CommandArgs, interaction: CommandInteraction): string[] {
  const args = [];
  for (const group of commandArgs.groups) {
    let selectedName: string | undefined;
    let selected: string | undefined;
    for (const option of group.options) {
      const value = interaction.options.getString(option.name) ?? undefined;
      if (value) {
        if (selected) {
          throw new EolianUserError(`You can not specify both ${selectedName} & ${option.name}`);
        }
        selectedName = option.name;
        selected = value;
      }
    }
    if (selected) {
      args.push(selected);
    } else if (group.required) {
      throw new EolianUserError(`You must provide ${group.options.map(o => `\`${o.name}\``).join(' or ')}`);
    }
  }
  return args;
}

function parseSlashKeyword(keyword: Keyword, permission: PERMISSION, interaction: CommandInteraction, options: CommandOptions, groupSet: Set<string>) {
  let found: Keyword | undefined;
  if (keyword.group) {
    if (!groupSet.has(keyword.group)) {
      const value = interaction.options.getString(keyword.group) ?? '';
      found = KEYWORDS[value.toUpperCase()];
      groupSet.add(keyword.group);
    }
  } else if (interaction.options.getBoolean(keyword.name.toLowerCase())) {
    found = keyword;
  }
  if (found) {
    checkSetKeyword(found, permission, options);
  }
}

function parseSlashPattern(pattern: Pattern, permission: PERMISSION, interaction: CommandInteraction, options: CommandOptions, patternSet: Set<string>, groupSet: Set<string>, args?: CommandArgs) {
  if (args && pattern.name === PATTERNS.ARG.name) {
    options.ARG = parseCommandArgs(args, interaction);
  } else if (pattern.group) {
    if (!groupSet.has(pattern.group)) {
      const text = interaction.options.getString(pattern.group);
      if (text) {
        matchPatterns(text, permission, patternSet, options, pattern.group);
      }
      groupSet.add(pattern.group);
    }
  } else {
    const text = interaction.options.getString(pattern.name.toLowerCase());
    if (text) {
      patternMatch(text, permission, pattern, options, SyntaxType.SLASH, true);
    }
  }
}

export function parseMessageCommand(name: string, text: string, permission: PERMISSION): ParsedCommand {
  const command = getMessageCommand(name, permission);

  const options: CommandOptions = {};
  const patternSet = new Set<string>(command.patterns?.map(p => p.name));
  matchPatterns(text, permission, patternSet, options);

  return { command, options };
}

function matchPatterns(text: string, permission: PERMISSION, patternSet: Set<string>, options: CommandOptions, group?: KeywordGroup) {
  for (const pattern of PATTERNS_SORTED) {
    if (!group || pattern.group === group) {
      if (patternSet.has(pattern.name) && pattern.name !== PATTERNS.SEARCH.name) {
        text = patternMatch(text, permission, pattern, options, SyntaxType.SLASH);
      }
    }
  }
  if (patternSet.has(PATTERNS.SEARCH.name) && text.length && PATTERNS.SEARCH.permission <= permission) {
    if (!group || PATTERNS.SEARCH.group === group) {
      options.SEARCH = text;
    }
  }
}

