import { logger } from 'common/logger';
import { UsersDb } from 'data/@types';
import { ButtonInteraction, DMChannel, GuildMember, Message, TextChannel } from 'discord.js';
import { ContextInteraction, ContextInteractionOptions, ContextMessage, ContextUser, EmbedMessageButton } from './@types';
import { DiscordTextChannel } from './channel';
import { DiscordMessage } from './message';
import { DiscordUser, getPermissionLevel } from './user';

export class ButtonRegistry {

  private readonly registry = new Map<string, Map<string, EmbedMessageButton>>();

  register(messageId: string, buttons: Map<string, EmbedMessageButton>): void {
    if (!this.registry.has(messageId)) {
      logger.info('Registered buttons for message %s', messageId);
    }
    this.registry.set(messageId, buttons);
  }

  getButton(messageId: string, buttonId: string): EmbedMessageButton | undefined {
    return this.registry.get(messageId)?.get(buttonId);
  }

  unregister(messageId: string): void {
    logger.info('Unregistering buttons for message %s', messageId);
    this.registry.delete(messageId);
  }

}

export class DiscordInteraction implements ContextInteraction {

  private _message?: ContextMessage;
  private _user?: ContextUser;

  constructor(private readonly button: ButtonInteraction,
    private readonly registry: ButtonRegistry,
    private readonly users: UsersDb) {
  }

  get message(): ContextMessage {
    if (!this._message) {
      const channel = new DiscordTextChannel(<TextChannel | DMChannel>this.button.channel, this.registry);
      this._message = new DiscordMessage(this.button.message as Message, channel);
    }
    return this._message;
  }

  get user(): ContextUser {
    if (!this._user) {
      this.button.memberPermissions
      const permission = getPermissionLevel(this.button.user, this.button.memberPermissions);
      if (typeof this.button.member.permissions !== 'string') {
        this._user = new DiscordUser(this.button.user, this.users, permission, this.button.member as GuildMember);
      } else {
        this._user = new DiscordUser(this.button.user, this.users, permission);
      }
    }
    return this._user;
  }

  get hasReplied(): boolean {
    return this.button.replied;
  }

  async reply(message: string, options?: ContextInteractionOptions): Promise<void> {
    await this.button.reply({ content: message, ephemeral: options?.ephemeral });
  }

  async defer(ephemeral?: boolean): Promise<void> {
    await this.button.deferReply({ ephemeral });
  }

}