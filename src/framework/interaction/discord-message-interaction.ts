import { CommandParsingStrategy, ParsedCommand, SyntaxType } from '@eolian/commands/@types';
import { UsersDb } from '@eolian/data/@types';
import { SelectionOption } from '@eolian/embed/@types';
import { Message, BaseMessageOptions, TextChannel, DMChannel } from 'discord.js';
import { ContextCommandInteraction, ContextUser, ContextTextChannel, ContextMessage, IAuthServiceProvider, SelectionResult, EmbedMessage, ContextServer } from '../@types';
import { ButtonRegistry } from '../button-registry';
import { DiscordMessageSender, DiscordChannelSender, DiscordTextChannel } from '../discord-channel';
import { DiscordMessage } from '../discord-message';
import { getPermissionLevel, DiscordUser } from '../discord-user';

class MessageInteractionSender implements DiscordMessageSender {

  constructor(private readonly message: Message) {}

  async send(options: BaseMessageOptions): Promise<Message<boolean>> {
    return this.message.reply(options);
  }

}

export class DiscordMessageInteraction implements ContextCommandInteraction {

  private _user?: ContextUser;
  private _channel?: ContextTextChannel;
  private _message?: ContextMessage;
  private _hasReplied = false;
  private _sender?: DiscordChannelSender;

  constructor(
    private readonly discordMessage: Message,
    private readonly parser: CommandParsingStrategy,
    private readonly registry: ButtonRegistry,
    private readonly users: UsersDb,
    private readonly auth: IAuthServiceProvider
  ) {}

  get sendable(): boolean {
    return this.channel.sendable;
  }

  get hasReplied(): boolean {
    return this._hasReplied;
  }

  get user(): ContextUser {
    if (!this._user) {
      const permission = getPermissionLevel(
        this.discordMessage.author,
        this.discordMessage.member?.permissions
      );
      this._user = new DiscordUser(
        this.discordMessage.author,
        this.users,
        permission,
        this.auth,
        this.discordMessage.member ?? undefined
      );
    }
    return this._user;
  }

  get channel(): ContextTextChannel {
    if (!this._channel) {
      this._channel = new DiscordTextChannel(
        <TextChannel | DMChannel>this.discordMessage.channel,
        this.registry
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

  private get sender(): DiscordChannelSender {
    if (!this._sender) {
      this._sender = new DiscordChannelSender(
        new MessageInteractionSender(this.discordMessage),
        this.registry,
        <TextChannel | DMChannel>this.discordMessage.channel
      );
    }
    return this._sender;
  }

  react(emoji: string): Promise<void> {
    return this.message.react(emoji);
  }

  send(message: string): Promise<ContextMessage | undefined> {
    return this.sender.send(message);
  }

  sendSelection(
    question: string,
    options: SelectionOption[],
    user: ContextUser
  ): Promise<SelectionResult> {
    return this.sender.sendSelection(question, options, user);
  }

  sendEmbed(embed: EmbedMessage): Promise<ContextMessage | undefined> {
    return this.sender.sendEmbed(embed);
  }

  async defer(): Promise<void> {
    // Do nothing since it doesn't matter here
  }

  async getCommand(config?: ContextServer): Promise<ParsedCommand> {
    let type: SyntaxType | undefined;
    if (config) {
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
