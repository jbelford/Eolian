import { logger } from 'common/logger';
import { UsersDb } from 'data/@types';
import { MessageComponent } from 'discord-buttons';
import { DMChannel, Message, TextChannel } from 'discord.js';
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

const EPHEMERAL_FLAG = 1 << 6;

export class DiscordInteraction implements ContextInteraction {

  private _message?: ContextMessage;
  private _user?: ContextUser;

  constructor(private readonly button: MessageComponent,
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
      const permission = getPermissionLevel(this.button.clicker.user, this.button.clicker.member);
      this._user = new DiscordUser(this.button.clicker.user, this.users, permission, this.button.clicker.member);
    }
    return this._user;
  }

  get hasReplied(): boolean {
    return this.button.reply.has;
  }

  async reply(message: string, options?: ContextInteractionOptions): Promise<void> {
    const data = { content: message };
    if (options?.ephemeral) {
      // @ts-ignore
      data.flags = EPHEMERAL_FLAG;
    }
    await this.button.reply.send(data);
  }

  async defer(ephemeral?: boolean): Promise<void> {
    await this.button.reply.defer(!!ephemeral);
  }

}