import { SlashCommandBuilder, SlashCommandStringOption } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { COMMANDS, COMMAND_MAP } from 'commands';
import { Command, CommandOptions, KeywordGroup, ParsedCommand, PatternGroup, SyntaxType } from 'commands/@types';
import { KEYWORDS, KEYWORD_GROUPS, PATTERNS_SORTED, PATTERN_GROUPS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { environment } from 'common/env';
import { EolianUserError } from 'common/errors';
import { logger } from 'common/logger';
import { Routes } from 'discord-api-types/v9';
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
      body: COMMANDS.map(mapCommandToSlashCommand)
    });

    logger.info('Successfully refreshed slash commands.');

    return true;
  } catch (e) {
    logger.warn('Failed to refresh slash commands: %s', e);
  }
  return false;
}

function mapCommandToSlashCommand(command: Command) {
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
      const keywordGroupOption = new Map<KeywordGroup, SlashCommandStringOption>();
      const patternGroupOption = new Map<PatternGroup, SlashCommandStringOption>();

      command.keywords?.forEach(keyword => {
        if (keyword.group) {
          const group = KEYWORD_GROUPS[keyword.group];
          if (keywordGroupOption.has(keyword.group)) {
            keywordGroupOption.get(keyword.group)!
              .addChoice(keyword.name.toLowerCase(), keyword.name.toLowerCase());
          } else {
            builder.addStringOption(option => {
              option.setName(keyword.group!).setDescription(group.details)
                .addChoice(keyword.name.toLowerCase(), keyword.name.toLowerCase());
              keywordGroupOption.set(keyword.group!, option);
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
      });

      command.patterns?.forEach(pattern => {
        if (pattern.group) {
          const group = PATTERN_GROUPS[pattern.group];
          if (!patternGroupOption.has(pattern.group)) {
            builder.addStringOption(option => {
              option.setName(pattern.group!).setDescription(group.details);
              patternGroupOption.set(pattern.group!, option);
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
      });
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

export function parseSlashCommand(interaction: CommandInteraction, permission: PERMISSION): ParsedCommand {
  const command = COMMAND_MAP[interaction.commandName];
  if (!command) {
    throw new Error('Unrecognized command!');
  } else if (command.permission > permission) {
    throw new EolianUserError('You do not have permission to use this command');
  }

  const options: CommandOptions = {};
  if (command.keywords || command.patterns) {
    const groupSet = new Set<string>();

    command.keywords?.forEach(keyword => {
      if (keyword.permission <= permission) {
        if (keyword.group) {
          if (!groupSet.has(keyword.group)) {
            const value = interaction.options.getString(keyword.group) ?? '';
            const keywordValue = KEYWORDS[value.toUpperCase()];
            if (keywordValue) {
              options[keywordValue.name] = true;
            }
            groupSet.add(keyword.group);
          }
        } else {
          const value = interaction.options.getBoolean(keyword.name.toLowerCase());
          if (value) {
            options[keyword.name] = true;
          }
        }
      }
    });

    const patternSet = new Set<string>(command.patterns?.map(p => p.name));

    command.patterns?.forEach(pattern => {
      if (pattern.permission <= permission) {
        if (pattern.group) {
          if (!groupSet.has(pattern.group)) {
            let text = interaction.options.getString(pattern.group);
            if (text) {
              for (const p of PATTERNS_SORTED) {
                if (p?.group === pattern.group && patternSet.has(p.name)) {
                  const result = p.matchText(text, SyntaxType.SLASH);
                  if (result.matches) {
                    options[p.name] = result.args;
                    text = result.newText;
                  }
                }
              }
            }
            groupSet.add(pattern.group);
          }
        } else {
          const text = interaction.options.getString(pattern.name.toLowerCase());
          if (text) {
            const result = pattern.matchText(text, SyntaxType.SLASH);
            if (result.matches) {
              options[pattern.name] = result.args;
            } else {
              throw new EolianUserError(`Provided option \`${pattern.name}\` is incorrectly specified. See \`/help ${pattern.name}\``);
            }
          }
        }
      }
    });

  } else {
    const args = (interaction.options.getString('args', false) ?? '').trim();
    if (args.length > 0) {
      options.ARG = args.split(' ');
    }
  }

  return { command, options };
}
