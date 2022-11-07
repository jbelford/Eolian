import { UsersDb } from '@eolian/data/@types';
import { SelectionOption } from '@eolian/embed/@types';
import {
  MessageComponentInteraction,
  CommandInteraction,
  GuildMember,
  TextChannel,
  DMChannel,
} from 'discord.js';
import {
  ContextInteraction,
  ContextUser,
  ContextTextChannel,
  ContextInteractionOptions,
  ContextMessage,
  SelectionResult,
  EmbedMessage,
  IAuthServiceProvider,
} from '../@types';
import { ButtonRegistry } from '../button-registry';
import { DiscordTextChannel } from '../discord-channel';
import { DiscordChannelSender } from '../discord-channel-sender';
import { getPermissionLevel, DiscordUser } from '../discord-user';
import { DiscordInteractionSender } from './discord-interaction-sender';

export class DiscordInteraction<T extends MessageComponentInteraction | CommandInteraction>
  implements ContextInteraction
{

  private _user?: ContextUser;
  private _channel?: ContextTextChannel;
  private _sender?: DiscordChannelSender;

  constructor(
    protected readonly interaction: T,
    protected readonly registry: ButtonRegistry,
    private readonly users: UsersDb,
    private readonly auth: IAuthServiceProvider
  ) {}

  get sendable(): boolean {
    return this.sender.sendable;
  }

  get user(): ContextUser {
    if (!this._user) {
      const permission = getPermissionLevel(
        this.interaction.user,
        this.interaction.memberPermissions
      );
      if (this.interaction.member) {
        this._user = new DiscordUser(
          this.interaction.user,
          this.users,
          permission,
          this.auth,
          this.interaction.member as GuildMember
        );
      } else {
        this._user = new DiscordUser(this.interaction.user, this.users, permission, this.auth);
      }
    }
    return this._user;
  }

  get channel(): ContextTextChannel {
    if (!this._channel) {
      this._channel = new DiscordTextChannel(
        <TextChannel | DMChannel>this.interaction.channel,
        this.registry
      );
    }
    return this._channel;
  }

  get hasReplied(): boolean {
    return this.interaction.replied;
  }

  private get sender(): DiscordChannelSender {
    if (!this._sender) {
      this._sender = new DiscordChannelSender(
        new DiscordInteractionSender(this.interaction),
        this.registry,
        <TextChannel | DMChannel>this.interaction.channel
      );
    }
    return this._sender;
  }

  async defer(ephemeral = true): Promise<void> {
    await this.interaction.deferReply({ ephemeral });
  }

  send(message: string, options?: ContextInteractionOptions): Promise<ContextMessage | undefined> {
    return this.sender.send(message, options);
  }

  sendSelection(
    question: string,
    options: SelectionOption[],
    user: ContextUser
  ): Promise<SelectionResult> {
    return this.sender.sendSelection(question, options, user);
  }

  async sendEmbed(
    embed: EmbedMessage,
    options?: ContextInteractionOptions
  ): Promise<ContextMessage | undefined> {
    return this.sender.sendEmbed(embed, options);
  }

}
