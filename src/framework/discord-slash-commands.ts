import { COMMANDS, MESSAGE_COMMANDS } from '@eolian/commands';
import { Command, CommandArgs, MessageCommand } from '@eolian/commands/@types';
import { UserPermission } from '@eolian/common/constants';
import { environment } from '@eolian/common/env';
import { logger } from '@eolian/common/logger';
import { KEYWORD_GROUPS, PATTERNS } from '@eolian/command-options';
import { KeywordGroup, Keyword, Pattern } from '@eolian/command-options/@types';
import {
  Routes,
  REST,
  RESTPostAPIApplicationCommandsJSONBody,
  SlashCommandBuilder,
  SlashCommandStringOption,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
} from 'discord.js';

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
  return registerSlashCommands(
    Routes.applicationGuildCommands(environment.tokens.discord.clientId, guildId),
  );
}

async function registerSlashCommands(route: `/${string}`): Promise<boolean> {
  try {
    const rest = new REST({ version: '10' }).setToken(environment.tokens.discord.main);

    await rest.put(route, {
      body: COMMANDS.list
        .filter(command => command.permission < UserPermission.Owner)
        .map(createSlashCommand)
        .concat(MESSAGE_COMMANDS.list.map(createContextMenuCommand)),
    });
    logger.info('Successfully refreshed slash commands.');

    return true;
  } catch (e) {
    logger.warn('Failed to refresh slash commands: %s', e);
  }
  return false;
}

function createSlashCommand(command: Command): RESTPostAPIApplicationCommandsJSONBody {
  try {
    let description = command.shortDetails ?? command.details;
    if (description.length > 100) {
      logger.warn('"%s" description is greater than 100 and is clamped', command.name);
      description = description.slice(0, 100);
    }

    const builder = new SlashCommandBuilder().setName(command.name).setDescription(description);

    builder.setDMPermission(!!command.dmAllowed);
    if (command.permission >= UserPermission.Admin) {
      builder.setDefaultMemberPermissions('0');
    }

    if (command.keywords || command.patterns) {
      const groupOption = new Map<KeywordGroup, SlashCommandStringOption>();
      command.patterns
        ?.sort((a, b) => b.priority - a.priority)
        .forEach(pattern => addPatternOption(builder, pattern, groupOption, command.args));
      command.keywords
        ?.sort((a, b) => a.name.localeCompare(b.name))
        .forEach(keyword => addKeywordOption(builder, keyword, groupOption));
    } else if (command.args) {
      addCommandArgOptions(builder, command.args);
    } else {
      builder.addStringOption(
        option =>
          (option = option
            .setName('args')
            .setDescription(`Use "/help ${command.name}" to see arguments`)
            .setRequired(false)),
      );
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
        optionBuilder.setName(option.name).setDescription(option.details).setRequired(false);
        if (option.getChoices) {
          const choices = option.getChoices();
          if (choices.length > 25) {
            logger.warn('Too many choices for %s option. Not adding choices.', option.name);
          } else {
            for (const choice of choices) {
              optionBuilder.addChoices({
                name: choice,
                value: choice,
              });
            }
          }
        }
        return optionBuilder;
      });
    }
  }
}

function addKeywordOption(
  builder: SlashCommandBuilder,
  keyword: Keyword,
  groupOption: Map<KeywordGroup, SlashCommandStringOption>,
) {
  const name = keyword.name.toLowerCase();
  if (keyword.group) {
    const option = groupOption.get(keyword.group);
    if (option) {
      option.addChoices({ name, value: name });
    } else {
      const group = KEYWORD_GROUPS[keyword.group];
      builder.addStringOption(option => {
        option
          .setName(keyword.group!)
          .setDescription(group.details)
          .addChoices({ name, value: name });
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

    builder.addBooleanOption(option =>
      option.setName(name).setDescription(details).setRequired(false),
    );
  }
}

function addPatternOption(
  builder: SlashCommandBuilder,
  pattern: Pattern,
  groupOption: Map<KeywordGroup, SlashCommandStringOption>,
  args?: CommandArgs,
) {
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

    builder.addStringOption(option =>
      option.setName(pattern.name.toLowerCase()).setDescription(details).setRequired(false),
    );
  }
}

function createContextMenuCommand(command: MessageCommand): RESTPostAPIApplicationCommandsJSONBody {
  try {
    return (
      new ContextMenuCommandBuilder()
        .setName(command.name)
        // @ts-expect-error This is a bug in the discordjs typings
        .setType(ApplicationCommandType.Message)
        .toJSON()
    );
  } catch (e) {
    logger.warn('Failed validation for %s', command);
    throw e;
  }
}
