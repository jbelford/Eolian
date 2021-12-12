import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { COMMANDS } from 'commands';
import { Command } from 'commands/@types';
import { environment } from 'common/env';
import { logger } from 'common/logger';
import { Routes } from 'discord-api-types/v9';

export async function registerSlashCommands() {
  if (!environment.tokens.discord.clientId) {
    logger.info('Missing client id. Not registering slash commands');
    return;
  }
  if (environment.prod) {
    logger.info('In prod environment. Not registering slash commands');
    return;
  }
  if (!environment.devGuild) {
    logger.info('Missing dev guild. Not registering slash commands for dev environment');
    return;
  }

  try {
    logger.info('Sending refresh for slash commands for guild %s', environment.devGuild);

    const rest = new REST({ version: '9' }).setToken(environment.tokens.discord.main);

    const route = Routes.applicationGuildCommands(environment.tokens.discord.clientId, environment.devGuild);
    await rest.put(route, {
      body: COMMANDS.map(mapCommandToSlashCommand)
    });

    logger.info('Successfully refreshed slash commands.');
  } catch (e) {
    logger.warn('Failed to refresh slash commands: %s', e);
  }
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
      .setDescription(description)
      .addStringOption(option => option.setName('args')
          .setDescription('See help for arguments')
          .setRequired(false));

    return builder.toJSON();
  } catch (e) {
    logger.warn('Failed validation for %s', command);
    throw e;
  }
}
