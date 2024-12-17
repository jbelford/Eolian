import { UsersDb } from '@eolian/data/@types';
import { MessageComponentInteraction, CommandInteraction, GuildMember } from 'discord.js';
import {
  ContextInteraction,
  ContextUser,
  ContextTextChannel,
  IAuthServiceProvider,
} from '../@types';
import { ButtonRegistry } from '../button-registry';
import { DiscordTextChannel } from '../discord-channel';
import { DiscordChannelSender, SupportedTextChannel } from '../discord-channel-sender';
import { getPermissionLevel, DiscordUser } from '../discord-user';
import { DiscordInteractionSender } from './discord-interaction-sender';

export class DiscordInteraction<T extends MessageComponentInteraction | CommandInteraction>
  extends DiscordChannelSender
  implements ContextInteraction
{
  private _user?: ContextUser;
  private _channel?: ContextTextChannel;

  constructor(
    protected readonly interaction: T,
    protected readonly registry: ButtonRegistry,
    private readonly users: UsersDb,
    private readonly auth: IAuthServiceProvider,
  ) {
    super(
      new DiscordInteractionSender(interaction),
      registry,
      interaction.channel as SupportedTextChannel,
    );
  }

  get user(): ContextUser {
    if (!this._user) {
      const permission = getPermissionLevel(
        this.interaction.user,
        this.interaction.memberPermissions,
      );
      if (this.interaction.member) {
        this._user = new DiscordUser(
          this.interaction.user,
          this.users,
          permission,
          this.auth,
          this.interaction.member as GuildMember,
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
        this.interaction.channel as SupportedTextChannel,
        this.registry,
      );
    }
    return this._channel;
  }

  get hasReplied(): boolean {
    return this.interaction.replied;
  }

  async defer(ephemeral = true): Promise<void> {
    await this.interaction.deferReply({ ephemeral });
  }
}
