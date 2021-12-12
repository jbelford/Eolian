import { CommandParsingStrategy } from 'commands/@types';
import { environment } from 'common/env';
import { EolianUserError } from 'common/errors';
import { logger } from 'common/logger';
import { InMemoryQueues, LockManager } from 'data';
import { AppDatabase, MusicQueueCache } from 'data/@types';
import { ButtonInteraction, Client, CommandInteraction, Guild, Intents, Interaction, Message } from 'discord.js';
import { DiscordPlayer } from 'music/player';
import { ContextClient, ContextCommandInteraction, EolianBot, ServerDetails, ServerState, ServerStateStore } from './@types';
import { ButtonRegistry } from "./button";
import { DiscordClient, DiscordGuildClient, DISCORD_INVITE_PERMISSIONS } from './client';
import { DiscordPlayerDisplay, DiscordQueueDisplay } from './display';
import { DiscordButtonInteraction, DiscordCommandInteraction, DiscordMessageInteraction } from './interaction';
import { GuildQueue } from './queue';
import { registerSlashCommands } from './register_commands';
import { DiscordGuild } from './server';
import { InMemoryServerStateStore } from './state';

const enum DiscordEvents {
  READY = 'ready',
  MESSAGE_CREATE = 'messageCreate',
  ERROR = 'error',
  RECONNECTING = 'shardReconnecting',
  RESUME = 'shardResume',
  DEBUG = 'debug',
  WARN = 'warn',
  GUILD_CREATE = 'guildCreate',
  INTERACTION_CREATE = 'interactionCreate'
}

// https://discord.com/developers/docs/topics/gateway#list-of-intents
const DISCORD_ENABLED_INTENTS = new Intents();
DISCORD_ENABLED_INTENTS.add(
  'GUILDS',
  // 'GUILD_MEMBERS',
  // 'GUILD_EMOJIS',
  // 'GUILD_INTEGRATIONS',
  // 'GUILD_WEBHOOKS',
  'GUILD_INVITES',
  'GUILD_VOICE_STATES',
  // 'GUILD_PRESENCES',
  'GUILD_MESSAGES',
  'GUILD_MESSAGE_REACTIONS',
  // 'GUILD_MESSAGE_TYPING',
  // 'DIRECT_MESSAGE_TYPING',
  'DIRECT_MESSAGES',
  'DIRECT_MESSAGE_REACTIONS');

const QUEUE_CACHE_TIMEOUT = 60 * 60 * 3;
const SERVER_STATE_CACHE_TIMEOUT = 60 * 15;
const USER_COMMAND_LOCK_TIMEOUT = 60;

export interface DiscordEolianBotArgs {
  db: AppDatabase,
  parser: CommandParsingStrategy,
}

export class DiscordEolianBot implements EolianBot {

  private readonly client: Client;
  private readonly parser: CommandParsingStrategy;
  private readonly registry = new ButtonRegistry();
  private readonly guildMap = new Map<string, ServerDetails>();
  private oldClient?: Client;
  private invite?: string;

  private readonly db: AppDatabase;
  private readonly queues: MusicQueueCache = new InMemoryQueues(QUEUE_CACHE_TIMEOUT);
  private readonly servers: ServerStateStore = new InMemoryServerStateStore(SERVER_STATE_CACHE_TIMEOUT);
  private readonly lockManager: LockManager = new LockManager(USER_COMMAND_LOCK_TIMEOUT);

  constructor({ parser, db }: DiscordEolianBotArgs) {
    this.parser = parser;
    this.db = db;

    this.client = new Client({ intents: DISCORD_ENABLED_INTENTS });

    this.client.once(DiscordEvents.READY, this.onReadyHandler);
    this.client.on(DiscordEvents.RECONNECTING, () => {
      logger.info('RECONNECTING TO WEBSOCKET')
    });
    this.client.on(DiscordEvents.RESUME, (replayed) => {
      logger.info(`CONNECTION RESUMED - REPLAYED: %s`, replayed)
    });
    this.client.on(DiscordEvents.WARN, (info) => {
      logger.warn(`Warn event emitted: %s`, info)
    });
    this.client.on(DiscordEvents.ERROR, (err) => {
      logger.warn(`An error event was emitted %s`, err)
    });
    this.client.on(DiscordEvents.MESSAGE_CREATE, this.onMessageHandler);
    this.client.on(DiscordEvents.INTERACTION_CREATE, this.onInteractionHandler);
    if (logger.isDebugEnabled()) {
      this.client.on(DiscordEvents.DEBUG, (info) => {
        logger.debug(`A debug event was emitted: %s`, info)
      });
    }

    if (environment.tokens.discord.old) {
      this.client.on(DiscordEvents.GUILD_CREATE, this.onGuildCreateHandler);
      this.oldClient = new Client({ intents: DISCORD_ENABLED_INTENTS });
      this.oldClient.once(DiscordEvents.READY, this.setPresence);
      this.oldClient.on(DiscordEvents.MESSAGE_CREATE, this.onMessageHandlerOld);
    }
  }

  async start(): Promise<void> {
    if (!this.client.readyTimestamp) {
      await registerSlashCommands();
      await this.client.login(environment.tokens.discord.main);
      await this.oldClient?.login(environment.tokens.discord.old);
    }
  }

  async close(): Promise<void> {
    this.client.destroy();
  }

  private onInteractionHandler = async (interaction: Interaction) => {
    try {
      if (!interaction.inCachedGuild()) {
        logger.warn('Ignoring interaction from guild not cached: %s', interaction);
        return;
      }
      if (interaction.isButton()) {
        await this.onButtonClickHandler(interaction);
      } else if (interaction.isCommand()) {
        await this.onCommandHandler(interaction);
      } else {
        logger.warn('Received unknown interaction type: %s', interaction.type);
      }
    } catch (e) {
      logger.warn('Unhandled occured executing interaction event: %s', e);
    }
  };

  private onButtonClickHandler = async (interaction: ButtonInteraction) => {
    const embedButton = this.registry.getButton(interaction.message.id, interaction.customId);
    if (embedButton) {
      const contextInteraction = new DiscordButtonInteraction(interaction, this.registry, this.db.users);
      const destroy = await embedButton.onClick(contextInteraction, embedButton.emoji);
      if (destroy) {
        contextInteraction.message.releaseButtons();
      }
    } else {
      logger.warn('Unknown button click received: %s %s', interaction.message.id, interaction.customId);
      await interaction.update({ content: `***Expired Message***`, components: [] });
      await interaction.followUp({ content: 'Sorry, this button has expired.', ephemeral: true });
    }
  };

  private onCommandHandler = async (interaction: CommandInteraction) => {
    const locked = await this.lockManager.isLocked(interaction.user.id);
    if (!locked) {
      try {
        await this.lockManager.lock(interaction.user.id);
        const contextInteraction = new DiscordCommandInteraction(interaction, this.parser, this.registry, this.db.users);

        const noDefault = await this.onBotInvoked(contextInteraction, interaction.guild ?? undefined);

        if (!contextInteraction.hasReplied && !noDefault) {
          await contextInteraction.reply('👌', { ephemeral: true });
        }
      } finally {
        await this.lockManager.unlock(interaction.user.id);
      }
    } else {
      await interaction.reply({ content: 'One command at a time please!', ephemeral: true  });
    }
  }

  /**
   * Executed when the connection has been established
   * and operations may begin to be performed
   */
  private onReadyHandler = async () => {
    try {
      logger.info('Discord bot is ready!');
      this.invite = this.client.generateInvite({ scopes: ['bot'], permissions: DISCORD_INVITE_PERMISSIONS });
      logger.info(`Bot invite link: %s`, this.invite);
      await this.setPresence();
    } catch (e) {
      logger.warn(`Ready handler failed: %s`, e);
    }
  }

  private setPresence = async () => {
    try {
      this.client.user!.setPresence({
        activities: [{
          name: `${environment.cmdToken}help`,
          type: 'LISTENING'
        }]
      });
    } catch (e) {
      logger.warn(`Failed to set presence: %s`, e);
    }
  };

  private onGuildCreateHandler = async (guild: Guild) => {
    await this.oldClient?.guilds.cache.get(guild.id)?.leave();
  };

  private onMessageHandler = async (message: Message): Promise<void> => {
    if (message.author.bot || !this.isTextOrDm(message)) {
      return;
    }

    try {
      if (await this.isBotInvoked(message)) {
        const locked = await this.lockManager.isLocked(message.author.id);
        if (!locked) {
          try {
            await this.lockManager.lock(message.author.id);
            const interaction = new DiscordMessageInteraction(message, this.parser, this.registry, this.db.users);
            await this.onBotInvoked(interaction, message.guild ?? undefined);
          } finally {
            await this.lockManager.unlock(message.author.id);
          }
        } else {
          await message.reply({ content: 'One command at a time please!' });
        }
      }
    } catch (e) {
      logger.warn(`Unhandled error occured during request: %s`, e);
    }
  }

  private onMessageHandlerOld = async (message: Message): Promise<void> => {
    if (message.author.bot || !this.isTextOrDm(message)) {
      return;
    }

    try {
      if (this.invite && await this.isBotInvoked(message)) {
        message.reply(`This bot is being migrated to a new token! Invite the new bot \n${this.invite}`);
      }
    } catch (e) {
      logger.warn(`Unhandled error occured during request: %s`, e);
    }
  }

  private async isBotInvoked(message: Message) {
    let invoked = message.mentions.has(this.client.user!, { ignoreEveryone: true });
    if (!invoked) {
      let prefix: string | undefined;
      if (message.guild) {
        const details = this.getGuildDetails(message.guild);
        const config = await details.get();
        prefix = config.prefix;
      }
      invoked = this.parser.messageInvokesBot(message.content, prefix);
      if (invoked) {
        message.content = message.content.slice(1);
      }
    }
    return invoked;
  }

  private async onBotInvoked(interaction: ContextCommandInteraction, guild?: Guild): Promise<boolean> {
    const start = Date.now();
    let noDefaultReply = false;
    try {
      logger.info(`[%s] Message event received: '%s'`, interaction.user.id, interaction.content);

      if (!interaction.sendable) {
        if (!interaction.channel.visible) {
          await interaction.reply(`I can't execute commands in this channel. I require \`View Channel\`, \`Send Messages\`, \`Embed Links\`, and \`Read Message History\` permissions.`)
        } else {
          await interaction.user.send(`I can't execute commands in that channel. I require \`View Channel\`, \`Send Messages\`, \`Embed Links\`, and \`Read Message History\` permissions.`);
        }
        return noDefaultReply;
      }

      let server: ServerState | undefined;
      let client: ContextClient;
      if (guild) {
        server = await this.getGuildState(guild);
        client = new DiscordGuildClient(this.client, server.details.id, this.db.servers);
      } else {
        client = new DiscordClient(this.client, this.db.servers);
      }

      const { command, options } = await interaction.getCommand(server?.details);
      if (interaction.channel.isDm && !command.dmAllowed) {
        await interaction.user.send(`Sorry, this command is not allowed via DM. Try again in a guild channel.`);
        return false;
      }

      await command.execute({ interaction, server, client}, options);

      await server?.details.updateUsage();

      noDefaultReply = !!command.noDefaultReply;
    } catch (e) {
      const userError = (e instanceof EolianUserError);

      if (interaction.sendable) {
        if (userError) {
          if (e.context) {
            await e.context.edit(e.message);
          } else {
            await interaction.reply(e.message);
          }
        } else {
          await interaction.reply(`Hmm.. I tried to do that but something in my internals is broken. Try again later.`);
        }
      } else {
        await interaction.user.send(`Hmm.. something went wrong and I can't send to that channel anymore. Try again and fix permissions if needed.`);
      }

      if (!userError) {
        throw e;
      }
    } finally {
      logger.info(`[%s] Message event finished (%d ms)`, interaction.user.id, Date.now() - start);
    }
    return noDefaultReply;
  }

  private isTextOrDm(message: Message): boolean {
    switch (message.channel.type) {
      case 'DM':
      case 'GUILD_TEXT':
        return true;
      default:
        return false;
    }
  }

  private async getGuildState(guild: Guild): Promise<ServerState> {
    let state = await this.servers.get(guild.id);
    if (!state) {
      const details = this.getGuildDetails(guild);
      const dto = await details.get();

      const guildClient = new DiscordGuildClient(this.client, guild.id, this.db.servers);
      const queue = new GuildQueue(this.queues, guild.id);
      const player = new DiscordPlayer(guildClient, queue, dto.volume);
      const queueDisplay = new DiscordQueueDisplay(queue);
      const playerDisplay = new DiscordPlayerDisplay(player, queueDisplay);

      state = { details, player, queue, display: { queue: queueDisplay, player: playerDisplay }, disposable: [] };
      await this.servers.set(guild.id, state);
    }
    return state;
  }

  private getGuildDetails(guild: Guild): ServerDetails {
    let details = this.guildMap.get(guild.id);
    if (!details) {
      details = new DiscordGuild(this.db.servers, guild);
      this.guildMap.set(guild.id, details);
    }
    return details;
  }

}
