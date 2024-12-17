import { CommandParsingStrategy, ParsedCommand } from '@eolian/commands/@types';
import { UsersDb } from '@eolian/data/@types';
import { Message, BaseMessageOptions } from 'discord.js';
import {
  ContextCommandInteraction,
  ContextUser,
  ContextTextChannel,
  ContextMessage,
  IAuthServiceProvider,
  ContextServer,
} from '../@types';
import { ButtonRegistry } from '../button-registry';
import { DiscordTextChannel } from '../discord-channel';
import { DiscordChannelSender, SupportedTextChannel } from '../discord-channel-sender';
import { DiscordMessage } from '../discord-message';
import { getPermissionLevel, DiscordUser } from '../discord-user';
import { DiscordMessageSender } from '../discord-sender';
import { SyntaxType } from '@eolian/command-options/@types';

class MessageInteractionSender implements DiscordMessageSender {
  constructor(private readonly message: Message) {}

  async send(options: BaseMessageOptions): Promise<Message<boolean>> {
    return this.message.reply(options);
  }
}

export class DiscordMessageInteraction
  extends DiscordChannelSender
  implements ContextCommandInteraction
{
  private _user?: ContextUser;
  private _channel?: ContextTextChannel;
  private _message?: ContextMessage;
  private _hasReplied = false;

  constructor(
    private readonly discordMessage: Message,
    private readonly parser: CommandParsingStrategy,
    private readonly registry: ButtonRegistry,
    private readonly users: UsersDb,
    private readonly auth: IAuthServiceProvider,
  ) {
    super(
      new MessageInteractionSender(discordMessage),
      registry,
      discordMessage.channel as SupportedTextChannel,
    );
  }

  get hasReplied(): boolean {
    return this._hasReplied;
  }

  get user(): ContextUser {
    if (!this._user) {
      const permission = getPermissionLevel(
        this.discordMessage.author,
        this.discordMessage.member?.permissions,
      );
      this._user = new DiscordUser(
        this.discordMessage.author,
        this.users,
        permission,
        this.auth,
        this.discordMessage.member ?? undefined,
      );
    }
    return this._user;
  }

  get channel(): ContextTextChannel {
    if (!this._channel) {
      this._channel = new DiscordTextChannel(
        this.discordMessage.channel as SupportedTextChannel,
        this.registry,
      );
    }
    return this._channel;
  }

  get message(): ContextMessage {
    if (!this._message) {
      this._message = new DiscordMessage(this.discordMessage);
    }
    return this._message;
  }

  get reactable(): boolean {
    return this.channel.reactable;
  }

  react(emoji: string): Promise<void> {
    return this.message.react(emoji);
  }

  async defer(): Promise<void> {
    // Do nothing since it doesn't matter here
  }

  async getCommand(config?: ContextServer): Promise<ParsedCommand> {
    let type: SyntaxType | undefined;
    const { syntax } = await this.user.get();
    if (syntax !== undefined) {
      type = syntax;
    } else if (config) {
      const dto = await config.get();
      type = dto.syntax;
    }
    return this.parser.parseCommand(removeMentions(this.message.text), this.user.permission, type);
  }

  toString(): string {
    return this.discordMessage.content;
  }
}

function removeMentions(text: string): string {
  return text.replace(/<(@[!]?|#)\d+>/g, '').trim();
}
