import { PERMISSION } from 'common/constants';
import environment from 'common/env';
import { logger } from 'common/logger';
import { Channel, Client, GuildMember, Message, Permissions, TextChannel } from 'discord.js';
import { DiscordTextChannel } from 'discord/channel';
import { DiscordBotService } from 'discord/client';
import { CHANNEL, EOLIAN_CLIENT_OPTIONS, EVENTS, INVITE_PERMISSIONS } from 'discord/constants';
import { DiscordMessage } from 'discord/message';
import { DiscordUser } from 'discord/user';
import { DefaultPlayerManager } from 'players/default/manager';
import { MusicQueueService } from 'services/queue';
import { EolianUserService } from 'services/user';

export type DiscordEolianBotArgs = {
  db: Database,
  store: MemoryStore,
  parser: CommandParsingStrategy
};

export class DiscordEolianBot implements EolianBot {

  private client: Client;
  private parser: CommandParsingStrategy;

  private services: CommandActionServices;

  constructor(args: DiscordEolianBotArgs) {
    this.parser = args.parser;

    this.client = new Client(EOLIAN_CLIENT_OPTIONS);
    this.client.once(EVENTS.READY, () => this.handleReady());
    this.client.on(EVENTS.RECONNECTING, () => logger.info('RECONNECTING TO WEBSOCKET'));
    this.client.on(EVENTS.RESUME, (replayed) => logger.info(`CONNECTION RESUMED - REPLAYED: ${replayed}`));
    this.client.on(EVENTS.DEBUG, (info) => logger.debug(`A debug event was emitted: ${info}`));
    this.client.on(EVENTS.WARN, (info) => logger.warn(`Warn event emitted: ${info}`));
    this.client.on(EVENTS.ERROR, (err) => logger.warn(`An error event was emitted ${err}`));
    this.client.on(EVENTS.MESSAGE, (message) => this.handleMessage(message));

    const users = new EolianUserService(args.db.usersDao);
    this.services = {
      bot: new DiscordBotService(this.client),
      playerManager: new DefaultPlayerManager(),
      queues: new MusicQueueService(args.store.queueDao),
      users
    }
  }

  async start() {
    if (!this.client.readyTimestamp) {
      await this.client.login(environment.tokens.discord);
    }
  }

  async close() {
    await this.client.destroy();
  }

  /**
   * Executed when the connection has been established
   * and operations may begin to be performed
   */
  private handleReady() {
    logger.info('Discord bot is ready!');
    if (this.client.guilds.size === 0 || process.argv.includes('-gi')) {
      this.client.generateInvite(INVITE_PERMISSIONS)
        .then(link => logger.info(`Bot invite link: ${link}`))
        .catch(err => logger.warn(`Failed to generate invite: ${err}`));
    }
    this.client.user.setPresence({ game: { name: `${environment.cmdToken}help` } })
      .catch(err => logger.warn(`Failed to set presence: ${err}`));
  }


  private async handleMessage(message: Message) {
    try {
      if (this.isIgnorable(message)) {
        return;
      }

      const { author, content, channel, member } = message;

      logger.debug(`Message event received: '${content}'`);

      if (!this.hasSendPermission(channel)) {
        return author.send(`I do not have permission to send messages to the channel.`);
      }

      const permission = getPermissionLevel(member);
      const [params, newText] = this.parser.parseParams(content, permission);

      const [cmd, err] = this.parser.parseCommand(newText, permission);
      if (err) {
        logger.debug(`Failed to get command action: ${err.message}`);
        return await message.reply(err.response);
      }

      const context: CommandActionContext = {
        user: new DiscordUser(author, this.services.users, permission),
        message: new DiscordMessage(message),
        channel: new DiscordTextChannel(channel)
      };

      await cmd.createAction(this.services).execute(context, params);
    } catch (e) {
      logger.warn(`Unhandled error occured during request: ${e.stack || e}`);
    }
  }

  private isIgnorable(message: Message) {
    return message.author.bot || (!message.isMentioned(this.client.user) && !this.parser.messageInvokesBot(message.content));
  }

  private hasSendPermission(channel: Channel) {
    return channel.type !== CHANNEL.TEXT || (<TextChannel>channel).permissionsFor(this.client.user).has(Permissions.FLAGS.SEND_MESSAGES);
  }

}


function getPermissionLevel(member: GuildMember): PERMISSION {
  if (environment.owners.includes(member.id)) return PERMISSION.OWNER;
  else if (member.roles.some(role => role.hasPermission(Permissions.FLAGS.ADMINISTRATOR))) return PERMISSION.ADMIN;
  return PERMISSION.USER;
}