import { CommandContext, CommandParsingStrategy } from 'commands/@types';
import { DiscordChannel, DiscordEvents, DISCORD_INVITE_PERMISSIONS, EOLIAN_CLIENT_OPTIONS, PERMISSION } from 'common/constants';
import { environment } from 'common/env';
import { EolianUserError } from 'common/errors';
import { logger } from 'common/logger';
import { AppDatabase, MemoryStore, ServerState, ServerStateStore } from 'data/@types';
import { InMemoryServerStateStore } from 'data/playerstore';
import { Channel, Client, DMChannel, GuildMember, Message, Permissions, TextChannel, User } from 'discord.js';
import { DiscordClient, DiscordMessage, DiscordTextChannel } from 'eolian';
import { DiscordPlayer, VoiceConnectionProvider } from 'music/player';
import { EolianUserService, MusicQueueService } from 'services';
import { EolianBot } from './@types';
import { DiscordGuildClient } from './client';
import { GuildQueue } from './queue';
import { DiscordUser } from './user';

export interface DiscordEolianBotArgs {
  db: AppDatabase,
  store: MemoryStore,
  parser: CommandParsingStrategy,
}

export class DiscordEolianBot implements EolianBot {

  private readonly client: Client;
  private readonly parser: CommandParsingStrategy;

  private readonly users: EolianUserService;
  private readonly queues: MusicQueueService;
  private readonly servers: ServerStateStore;

  constructor(args: DiscordEolianBotArgs) {
    this.parser = args.parser;

    this.client = new Client(EOLIAN_CLIENT_OPTIONS);
    this.client.once(DiscordEvents.READY, () => this.handleReady());
    this.client.on(DiscordEvents.RECONNECTING, () => logger.info('RECONNECTING TO WEBSOCKET'));
    this.client.on(DiscordEvents.RESUME, (replayed) => logger.info(`CONNECTION RESUMED - REPLAYED: ${replayed}`));
    this.client.on(DiscordEvents.DEBUG, (info) => logger.debug(`A debug event was emitted: ${info}`));
    this.client.on(DiscordEvents.WARN, (info) => logger.warn(`Warn event emitted: ${info}`));
    this.client.on(DiscordEvents.ERROR, (err) => logger.warn(`An error event was emitted ${err}`));
    this.client.on(DiscordEvents.MESSAGE, (message) => this.handleMessage(message));

    this.users = new EolianUserService(args.db.users);
    this.queues = new MusicQueueService(args.store.queueDao);
    this.servers = new InMemoryServerStateStore();
  }

  async start() {
    if (!this.client.readyTimestamp) {
      await this.client.login(environment.tokens.discord);
    }
  }

  async close() {
    this.client.destroy();
  }

  /**
   * Executed when the connection has been established
   * and operations may begin to be performed
   */
  private handleReady() {
    logger.info('Discord bot is ready!');
    if (this.client.guilds.cache.size === 0 || process.argv.includes('-gi')) {
      this.client.generateInvite({ permissions: DISCORD_INVITE_PERMISSIONS })
        .then(link => logger.info(`Bot invite link: ${link}`))
        .catch(err => logger.warn(`Failed to generate invite: ${err}`));
    }
    this.client.user!.setPresence({
        activity: { name: `${environment.cmdToken}help`, type: 'LISTENING' }
      })
      .catch(err => logger.warn(`Failed to set presence: ${err}`));
  }

  private async handleMessage(message: Message): Promise<void> {
    try {
      if (this.isIgnorable(message)) {
        return;
      }

      const { author, content, channel, member, guild } = message;

      logger.debug(`Message event received: '${content}'`);

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
        context.server = this.getGuildState(guild.id);
        context.client = new DiscordGuildClient(this.client, context.server.player as DiscordPlayer);
      } else {
        throw new Error('Guild is missing from text message');
      }

      context.user = new DiscordUser(author, this.users, permission, member);
      context.message = new DiscordMessage(message);
      context.channel = new DiscordTextChannel(<TextChannel | DMChannel>channel, this.users);

      await command.execute(context, options);
    } catch (e) {
      if (e instanceof EolianUserError) {
        await message.reply(e.message);
      } else {
        logger.warn(`Unhandled error occured during request: ${e.stack || e}`);
        await message.reply(`Hmm.. I tried to do that but something in my internals is broken. Try again later.`);
      }
    }
  }

  private isIgnorable(message: Message) {
    return message.author.bot
      || message.channel.type === 'news'
      || (!message.mentions.has(this.client.user!) && !this.parser.messageInvokesBot(message.content));
  }

  private hasSendPermission(channel: Channel) {
    switch (channel.type) {
      case DiscordChannel.TEXT:
        const permissions = (channel as TextChannel).permissionsFor(this.client.user!);
        return !!permissions && permissions.has(Permissions.FLAGS.SEND_MESSAGES as number);
      case DiscordChannel.DM:
        return true;
      default:
        return false;
    }
  }

  private getGuildState(guildId: string): ServerState {
    let state = this.servers.get(guildId);
    if (!state) {
      const connectionProvider = new VoiceConnectionProvider(this.client, guildId);
      const queue = new GuildQueue(this.queues, guildId);
      const player = new DiscordPlayer(connectionProvider, queue);
      state = { player, queue };
      this.servers.set(guildId, state);
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
