import { CommandContext, CommandParsingStrategy, SyntaxType } from 'commands/@types';
import { environment } from 'common/env';
import { EolianUserError } from 'common/errors';
import { logger } from 'common/logger';
import { InMemoryQueues, LockManager } from 'data';
import { AppDatabase, MusicQueueCache } from 'data/@types';
import { Client, DMChannel, Guild, Intents, Interaction, Message, TextChannel } from 'discord.js';
import { DiscordPlayer } from 'music/player';
import { EolianBot, ServerDetails, ServerState, ServerStateStore } from './@types';
import { ButtonRegistry, DiscordInteraction } from './button';
import { DiscordTextChannel } from './channel';
import { DiscordClient, DiscordGuildClient, DISCORD_INVITE_PERMISSIONS } from './client';
import { DiscordPlayerDisplay, DiscordQueueDisplay } from './display';
import { DiscordMessage } from './message';
import { GuildQueue } from './queue';
import { DiscordGuild } from './server';
import { InMemoryServerStateStore } from './state';
import { DiscordUser, getPermissionLevel } from './user';

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
      await this.client.login(environment.tokens.discord.main);
      await this.oldClient?.login(environment.tokens.discord.old);
    }
  }

  async close(): Promise<void> {
    this.client.destroy();
  }

  private onInteractionHandler = async (interaction: Interaction) => {
    if (interaction.isButton()) {
      const embedButton = this.registry.getButton(interaction.message.id, interaction.customId);
      if (embedButton) {
        try {
          const contextInteraction = new DiscordInteraction(interaction, this.registry, this.db.users);
          const destroy = await embedButton.onClick(contextInteraction, embedButton.emoji);
          if (destroy) {
            this.registry.unregister(interaction.message.id);
          }
          if (!contextInteraction.hasReplied) {
            await interaction.reply({});
          }
        } catch (e) {
          logger.warn('Unhandled occured executing button event: %s', e);
        }
      }
    }
  };

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
            await this.onBotInvoked(message);
          } finally {
            await this.lockManager.unlock(message.author.id);
          }
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

  private async onBotInvoked(message: Message): Promise<void> {
    const start = Date.now();
    const { author, content, channel, member, guild } = message;
    logger.info(`[%s] Message event received: '%s'`, author.id, content);

    // @ts-ignore
    const context: CommandContext = {};
    context.channel = new DiscordTextChannel(<TextChannel | DMChannel>channel, this.registry);

    try {

      if (!context.channel.sendable) {
        author.send(`I can't send messages to that channel. I require both \`Send Messages\` and \`Embed Links\` permissions.`);
        return;
      }

      let type: SyntaxType | undefined;
      if (guild) {
        const details = this.getGuildDetails(guild);
        const dto = await details.get();
        type = dto.syntax;
      }

      const permission = getPermissionLevel(author, member?.permissions);
      const { command, options } = this.parser.parseCommand(removeMentions(content), permission, type);

      if (channel instanceof DMChannel) {
        if (!command.dmAllowed) {
          author.send(`Sorry, this command is not allowed via DM. Try again in a guild channel.`);
          return;
        }
        context.client = new DiscordClient(this.client, this.db.servers);
      } else if (guild) {
        context.server = await this.getGuildState(guild);
        context.client = new DiscordGuildClient(this.client, guild.id, this.db.servers);
      } else {
        throw new Error('Guild is missing from text message');
      }

      context.user = new DiscordUser(author, this.db.users, permission, member ?? undefined);
      context.message = new DiscordMessage(message, context.channel);

      await command.execute(context, options);

      await context.server?.details.updateUsage();
    } catch (e) {
      const userError = (e instanceof EolianUserError);

      if (context.channel.sendable) {
        const text = userError ? (e as EolianUserError).message : `Hmm.. I tried to do that but something in my internals is broken. Try again later.`;
        await message.reply(text);
      } else {
        await author.send(`Hmm.. something went wrong and I can't send to that channel anymore. Try again and fix permissions if needed.`);
      }

      if (!userError) {
        throw e;
      }
    } finally {
      logger.info(`[%s] Message event finished (%d ms)`, author.id, Date.now() - start);
    }
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

function removeMentions(text: string): string {
  return text.replace(/<(@[!&]?|#)\d+>/g, '').trim();
}
