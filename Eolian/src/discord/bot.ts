import { Client, GuildMember, Permissions, TextChannel } from 'discord.js';
import { logger } from '../common/logger';
import environment from '../environments/env';
import { CHANNEL, EOLIAN_CLIENT_OPTIONS, EVENTS, INVITE_PERMISSIONS } from './constants';

class DiscordEolianBot implements EolianBot {

  private readonly client: Client;

  constructor() {
    this.client = new Client(EOLIAN_CLIENT_OPTIONS);
    this.client.once(EVENTS.READY, this.readyEventHandler);
    this.client.on(EVENTS.RECONNECTING, () => logger.warn('RECONNECTING TO WEBSOCKET'));
    this.client.on(EVENTS.RESUME, (replayed) => logger.info(`CONNECTION RESUMED - REPLAYED: ${replayed}`));
    this.client.on(EVENTS.DEBUG, (err) => logger.warn(`An error event was emitted: ${err}`));
    this.client.on(EVENTS.WARN, (info) => logger.warn(`Warn event emitted: ${info}`));
    this.client.on(EVENTS.ERROR, (err) => logger.warn(`An error event was emitted ${err}`));
  }

  public async start() {
    if (!this.client.readyTimestamp)
      await this.client.login(environment.tokens.discord);
  }

  public async stop() {
    await this.client.destroy();
  }

  public onMessage(parseStrategy: CommandParsingStrategy) {
    this.client.on(EVENTS.MESSAGE, ({ author, member, content, channel, reply, isMentioned }) => {
      if (author.bot) return;
      else if (!isMentioned(this.client.user) && !parseStrategy.messageInvokesBot(content)) return;

      logger.debug(`Message event received: '${content}'`);

      if (channel.type === CHANNEL.TEXT && !this.hasSendPermission(<TextChannel>channel)) {
        return author.send(`I do not have permission to send messages to the channel \`#${(<TextChannel>channel).name}\``)
          .catch(err => logger.warn(`Failed to send to user: ${err}`));
      }

      const [action, err] = parseStrategy.convertToExecutable(content, this.getPermissionLevel(member));
      if (err) {
        logger.debug(`Failed to get command action: ${err.message}`);
        return reply(err.response);
      }

      const user: ChatUser = { id: author.id };
      action.execute({ user: user })
        .then(response => reply(response).catch(err => logger.warn(`Failed to send to user: ${err}`)))
        .catch(this.commandErrorHandler);
    });
  }

  /**
   * Executed when the connection has been established
   * and operations may begin to be performed
   */
  private readyEventHandler = () => {
    logger.info('Discord bot is ready!');
    if (this.client.guilds.size === 0 || process.argv.includes('-gi')) {
      this.client.generateInvite(INVITE_PERMISSIONS)
        .then(link => logger.info(`Bot invite link: ${link}`))
        .catch(err => logger.warn(`Failed to generate invite: ${err}`));
    }
    this.client.user.setPresence({ game: { name: `${environment.cmdToken}help` } })
      .catch(err => logger.warn(`Failed to set presence: ${err}`));
  }

  private hasSendPermission(channel: TextChannel) {
    return channel.permissionsFor(this.client.user).has(Permissions.FLAGS.SEND_MESSAGES);
  }

  private getPermissionLevel(member: GuildMember): PERMISSION {
    if (environment.owners.includes(member.id)) return PERMISSION.OWNER;
    else if (member.roles.some(role => role.hasPermission(Permissions.FLAGS.ADMINISTRATOR))) return PERMISSION.ADMIN;
    return PERMISSION.USER;
  }

  private commandErrorHandler = (reason?: any) => {

  }

}