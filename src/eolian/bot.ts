import { CommandContext, CommandParsingStrategy } from 'commands/@types';
import { DiscordEvents, DISCORD_INVITE_PERMISSIONS, EOLIAN_CLIENT_OPTIONS, PERMISSION } from 'common/constants';
import { environment } from 'common/env';
import { EolianUserError } from 'common/errors';
import { logger } from 'common/logger';
import { LockManager } from 'data';
import { AppDatabase, MemoryStore, MusicQueueCache } from 'data/@types';
import { Client, DMChannel, Guild, GuildMember, Message, Permissions, TextChannel, User } from 'discord.js';
import { DiscordPlayer, DiscordVoiceConnectionProvider } from 'music/player';
import { EolianBot, ServerDetails, ServerState, ServerStateStore } from './@types';
import { DiscordTextChannel } from './channel';
import { DiscordClient, DiscordGuildClient } from './client';
import { DiscordPlayerDisplay, DiscordQueueDisplay } from './display';
import { DiscordMessage } from './message';
import { GuildQueue } from './queue';
import { DiscordGuild } from './server';
import { InMemoryServerStateStore } from './state';
import { DiscordUser } from './user';

export interface DiscordEolianBotArgs {
  db: AppDatabase,
  store: MemoryStore,
  parser: CommandParsingStrategy,
}

const SERVER_STATE_CACHE_TIMEOUT = 60 * 15;
const USER_COMMAND_LOCK_TIMEOUT = 60;

export class DiscordEolianBot implements EolianBot {

  private readonly client: Client;
  private readonly parser: CommandParsingStrategy;
  private readonly guildMap = new Map<string, ServerDetails>();

  private readonly db: AppDatabase;
  private readonly queues: MusicQueueCache;
  private readonly servers: ServerStateStore = new InMemoryServerStateStore(SERVER_STATE_CACHE_TIMEOUT);
  private readonly lockManager: LockManager = new LockManager(USER_COMMAND_LOCK_TIMEOUT);

  constructor(args: DiscordEolianBotArgs) {
    this.parser = args.parser;
    this.db = args.db;
    this.queues = args.store.queue;

    this.client = new Client(EOLIAN_CLIENT_OPTIONS);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('discord-buttons')(this.client);

    this.client.once(DiscordEvents.READY, this.onReadyHandler);
    this.client.on(DiscordEvents.RECONNECTING, () => logger.info('RECONNECTING TO WEBSOCKET'));
    this.client.on(DiscordEvents.RESUME, (replayed) => logger.info(`CONNECTION RESUMED - REPLAYED: %s`, replayed));
    this.client.on(DiscordEvents.WARN, (info) => logger.warn(`Warn event emitted: %s`, info));
    this.client.on(DiscordEvents.ERROR, (err) => logger.warn(`An error event was emitted %s`, err));
    this.client.on(DiscordEvents.MESSAGE, this.onMessageHandler);
    if (logger.isDebugEnabled()) {
      this.client.on(DiscordEvents.DEBUG, (info) => logger.debug(`A debug event was emitted: %s`, info));
    }
  }

  async start(): Promise<void> {
    if (!this.client.readyTimestamp) {
      await this.client.login(environment.tokens.discord);
    }
  }

  async close(): Promise<void> {
    this.client.destroy();
  }

  /**
   * Executed when the connection has been established
   * and operations may begin to be performed
   */
  private onReadyHandler = () => {
    logger.info('Discord bot is ready!');
    if (this.client.guilds.cache.size === 0 || process.argv.includes('-gi')) {
      this.client.generateInvite({ permissions: DISCORD_INVITE_PERMISSIONS })
        .then(link => logger.info(`Bot invite link: %s`, link))
        .catch(err => logger.warn(`Failed to generate invite: %s`, err));
    }
    this.client.user!.setPresence({
        activity: { name: `${environment.cmdToken}help`, type: 'LISTENING' }
      })
      .catch(err => logger.warn(`Failed to set presence: %s`, err));
  }

  private onMessageHandler = async (message: Message): Promise<void> => {
    if (message.author.bot || message.channel.type === 'news') {
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

  private async isBotInvoked(message: Message) {
    let invoked = message.mentions.has(this.client.user!);
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
    const { author, content, channel, member, guild } = message;

    logger.info(`Message event received: '%s'`, content);

    // @ts-ignore
    const context: CommandContext = {};
    context.channel = new DiscordTextChannel(<TextChannel | DMChannel>channel, this.db.users);

    try {

      if (!context.channel.sendable) {
        author.send(`I can't send messages to that channel.`);
        return;
      }

      const permission = getPermissionLevel(author, member);
      const { command, options } = this.parser.parseCommand(removeMentions(content), permission);

      if (channel instanceof DMChannel) {
        if (!command.dmAllowed) {
          author.send(`Sorry, this command is not allowed via DM. Try again in a guild channel.`);
          return;
        }
        context.client = new DiscordClient(this.client);
      } else if (guild) {
        context.server = await this.getGuildState(guild);
        context.client = new DiscordGuildClient(this.client, context.server.player as DiscordPlayer);
      } else {
        throw new Error('Guild is missing from text message');
      }

      context.user = new DiscordUser(author, this.db.users, permission, member);
      context.message = new DiscordMessage(message, context.channel);

      await command.execute(context, options);
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
    }
  }

  private async getGuildState(guild: Guild): Promise<ServerState> {
    let state = await this.servers.get(guild.id);
    if (!state) {
      const details = this.getGuildDetails(guild);
      const dto = await details.get();

      const connectionProvider = new DiscordVoiceConnectionProvider(this.client, guild.id);
      const queue = new GuildQueue(this.queues, guild.id);
      const player = new DiscordPlayer(connectionProvider, queue, dto.volume);
      const queueDisplay = new DiscordQueueDisplay(queue);
      const playerDisplay = new DiscordPlayerDisplay(player, queueDisplay);

      state = { details, player, queue, display: { queue: queueDisplay, player: playerDisplay } };
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

function getPermissionLevel(user: User, member?: GuildMember | null): PERMISSION {
  if (environment.owners.includes(user.id)) {
    return PERMISSION.OWNER;
  } else if (member && member.roles.cache.some(role => role.permissions.has(Permissions.FLAGS.ADMINISTRATOR))) {
    return PERMISSION.ADMIN;
  }
  return PERMISSION.USER;
}

function removeMentions(text: string): string {
  return text.replace(/<(@[!&]?|#)\d+>/g, '').trim();
}
