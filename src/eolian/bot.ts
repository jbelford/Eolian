import { CommandContext, CommandParsingStrategy } from 'commands/@types';
import { DiscordChannel, DiscordEvents, DISCORD_INVITE_PERMISSIONS, EOLIAN_CLIENT_OPTIONS, PERMISSION } from 'common/constants';
import { environment } from 'common/env';
import { EolianUserError } from 'common/errors';
import { logger } from 'common/logger';
import { LockManager } from 'data';
import { AppDatabase, MemoryStore, MusicQueueCache, UsersDb } from 'data/@types';
import { Channel, Client, DMChannel, GuildMember, Message, Permissions, TextChannel, User } from 'discord.js';
import { DiscordPlayer, DiscordVoiceConnectionProvider } from 'music/player';
import { EolianBot, ServerState, ServerStateStore } from './@types';
import { DiscordTextChannel } from './channel';
import { DiscordClient, DiscordGuildClient } from './client';
import { DiscordPlayerDisplay, DiscordQueueDisplay } from './display';
import { DiscordMessage } from './message';
import { GuildQueue } from './queue';
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

  private readonly users: UsersDb;
  private readonly queues: MusicQueueCache;
  private readonly servers: ServerStateStore = new InMemoryServerStateStore(SERVER_STATE_CACHE_TIMEOUT);
  private readonly lockManager: LockManager = new LockManager(USER_COMMAND_LOCK_TIMEOUT);

  constructor(args: DiscordEolianBotArgs) {
    this.parser = args.parser;
    this.users = args.db.users;
    this.queues = args.store.queue;

    this.client = new Client(EOLIAN_CLIENT_OPTIONS);
    this.client.once(DiscordEvents.READY, this.onReadyHandler);
    this.client.on(DiscordEvents.RECONNECTING, () => logger.info('RECONNECTING TO WEBSOCKET'));
    this.client.on(DiscordEvents.RESUME, (replayed) => logger.info(`CONNECTION RESUMED - REPLAYED: %s`, replayed));
    this.client.on(DiscordEvents.WARN, (info) => logger.warn(`Warn event emitted: %s`, info));
    this.client.on(DiscordEvents.ERROR, (err) => logger.warn(`An error event was emitted %s`, err));
    this.client.on(DiscordEvents.MESSAGE, this.onMessageHandler);
    if (logger.isDebugEnabled()) {
      this.client.on(DiscordEvents.DEBUG, (info) => logger.debug(`A debug event was emitted: ${info}`));
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

  private onMessageHandler = async (message: Message): Promise<void>  => {
    if (message.author.bot || message.channel.type === 'news') {
      return;
    }

    if (message.mentions.has(this.client.user!) || this.parser.messageInvokesBot(message.content)) {
      const locked = await this.lockManager.isLocked(message.author.id);
      if (!locked) {
        try {
          await this.lockManager.lock(message.author.id);
          await this.onBotInvoked(message);
        } catch (e) {
          if (e instanceof EolianUserError) {
            await message.reply(e.message);
          } else {
            logger.warn(`Unhandled error occured during request: %s`, e);
            await message.reply(`Hmm.. I tried to do that but something in my internals is broken. Try again later.`);
          }
        } finally {
          await this.lockManager.unlock(message.author.id);
        }
      }
    }
  }

  private async onBotInvoked(message: Message): Promise<void> {
    const { author, content, channel, member, guild } = message;

    logger.debug(`Message event received: '%s'`, content);

    if (!this.hasSendPermission(channel)) {
      author.send(`I do not have permission to send messages to the channel.`);
      return;
    }

    const permission = getPermissionLevel(author, member);
    const { command, options } = this.parser.parseCommand(removeMentions(content), permission);

    // @ts-ignore
    const context: CommandContext = {};

    if (channel instanceof DMChannel) {
      if (!command.dmAllowed) {
        author.send(`Sorry, this command is not allowed via DM. Try again in a guild channel.`);
        return;
      }
      context.client = new DiscordClient(this.client);
    } else if (guild) {
      context.server = await this.getGuildState(guild.id);
      context.client = new DiscordGuildClient(this.client, context.server.player as DiscordPlayer);
    } else {
      throw new Error('Guild is missing from text message');
    }

    context.user = new DiscordUser(author, this.users, permission, member);
    context.message = new DiscordMessage(message);
    context.channel = new DiscordTextChannel(<TextChannel | DMChannel>channel, this.users);

    await command.execute(context, options);
  }

  private hasSendPermission(channel: Channel) {
    switch (channel.type) {
      case DiscordChannel.TEXT: {
        const permissions = (channel as TextChannel).permissionsFor(this.client.user!);
        return !!permissions && permissions.has(Permissions.FLAGS.SEND_MESSAGES as number);
      }
      case DiscordChannel.DM:
        return true;
      default:
        return false;
    }
  }

  private async getGuildState(guildId: string): Promise<ServerState> {
    let state = await this.servers.get(guildId);
    if (!state) {
      const connectionProvider = new DiscordVoiceConnectionProvider(this.client, guildId);
      const queue = new GuildQueue(this.queues, guildId);
      const player = new DiscordPlayer(connectionProvider, queue);
      const queueDisplay = new DiscordQueueDisplay(queue);
      const playerDisplay = new DiscordPlayerDisplay(player, queueDisplay);
      state = { player, queue, display: { queue: queueDisplay, player: playerDisplay } };
      await this.servers.set(guildId, state);
    }
    return state;
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
