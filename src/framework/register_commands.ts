import { ContextMenuCommandBuilder, SlashCommandBuilder, SlashCommandStringOption } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { checkSetKeyword, COMMANDS, getCommand, getMessageCommand, MESSAGE_COMMANDS, patternMatch, simpleOptionsStrategy } from 'commands';
import { Command, CommandOptions, Keyword, KeywordGroup, MessageCommand, ParsedCommand, Pattern, PatternGroup, SyntaxType } from 'commands/@types';
import { KEYWORDS, KEYWORD_GROUPS, PATTERNS, PATTERNS_SORTED, PATTERN_GROUPS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { environment } from 'common/env';
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

    if (command.keywords || command.patterns) {
      const groupOption = new Map<KeywordGroup | PatternGroup, SlashCommandStringOption>();
      command.keywords?.forEach(keyword => addKeywordOption(builder, keyword, groupOption));
      command.patterns?.forEach(pattern => addPatternOption(builder, pattern, groupOption));
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

function addKeywordOption(builder: SlashCommandBuilder, keyword: Keyword, groupOption: Map<KeywordGroup | PatternGroup, SlashCommandStringOption>) {
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

function addPatternOption(builder: SlashCommandBuilder, pattern: Pattern<unknown>, groupOption: Map<KeywordGroup | PatternGroup, SlashCommandStringOption>) {
  if (pattern.group) {
    if (!groupOption.has(pattern.group)) {
      const group = PATTERN_GROUPS[pattern.group];
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
    command.patterns?.forEach(pattern => parseSlashPattern(pattern, permission, interaction, options, patternSet, groupSet));
  } else {
    options = simpleOptionsStrategy(interaction.options.getString('args', false) ?? '');
  }

  return { command, options };
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

function parseSlashPattern(pattern: Pattern<unknown>, permission: PERMISSION, interaction: CommandInteraction, options: CommandOptions, patternSet: Set<string>, groupSet: Set<string>) {
  if (pattern.group) {
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

function matchPatterns(text: string, permission: PERMISSION, patternSet: Set<string>, options: CommandOptions, group?: PatternGroup) {
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

