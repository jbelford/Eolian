import { COMMAND_MAP } from 'commands';
import { CommandParsingStrategy, ParsedCommand, SyntaxType } from 'commands/@types';
import { logger } from 'common/logger';
import { UsersDb } from 'data/@types';
import { ButtonInteraction, CommandInteraction, DMChannel, GuildMember, Message, MessageOptions, TextChannel } from 'discord.js';
import { SelectionOption } from 'embed/@types';
import { ContextButtonInteraction, ContextCommandInteraction, ContextInteraction, ContextInteractionOptions, ContextMessage, ContextTextChannel, ContextUser, EmbedMessage, ServerDetails } from './@types';
import { ButtonRegistry } from './button';
import { DiscordMessageSender, DiscordSender, DiscordTextChannel } from './channel';
import { DiscordMessage } from './message';
import { DiscordUser, getPermissionLevel } from './user';

class DiscordInteractionSender implements DiscordMessageSender {

  constructor(private readonly interaction: ButtonInteraction | CommandInteraction) {
  }

  async send(options: MessageOptions): Promise<Message> {
    let reply: Message;
    if (!this.interaction.replied) {
      reply = await this.interaction.reply({ ...options, ephemeral: !options.components, fetchReply: true }) as Message;
    } else {
      reply = await this.interaction.followUp({ ...options, ephemeral: !options.components, fetchReply: true }) as Message;
    }
    return reply;
  }

}


class DiscordInteraction<T extends ButtonInteraction | CommandInteraction> implements ContextInteraction {

  private _user?: ContextUser;
  private _channel?: ContextTextChannel;
  private _sender?: DiscordSender;

  constructor(protected readonly interaction: T,
    private readonly registry: ButtonRegistry,
    private readonly users: UsersDb) {
  }

  get sendable(): boolean {
    return this.sender.sendable;
  }

  get user(): ContextUser {
    if (!this._user) {
      const permission = getPermissionLevel(this.interaction.user, this.interaction.memberPermissions);
      if (typeof this.interaction.member.permissions !== 'string') {
        this._user = new DiscordUser(this.interaction.user, this.users, permission, this.interaction.member as GuildMember);
      } else {
        this._user = new DiscordUser(this.interaction.user, this.users, permission);
      }
    }
    return this._user;
  }

  get channel(): ContextTextChannel {
    if (!this._channel) {
      this._channel = new DiscordTextChannel(<TextChannel | DMChannel>this.interaction.channel, this.registry);
    }
    return this._channel;
  }

  get hasReplied(): boolean {
    return this.interaction.replied;
  }

  private get sender(): DiscordSender {
    if (!this._sender) {
      this._sender = new DiscordSender(new DiscordInteractionSender(this.interaction), this.registry, <TextChannel | DMChannel>this.interaction.channel);
    }
    return this._sender;
  }

  async reply(message: string, options?: ContextInteractionOptions): Promise<void> {
    const ephemeral = options?.ephemeral ?? true;
    if (!this.hasReplied) {
      await this.interaction.reply({ content: message, ephemeral });
    } else {
      await this.interaction.followUp({ content: message, ephemeral });
    }
  }

  async defer(ephemeral?: boolean): Promise<void> {
    await this.interaction.deferReply({ ephemeral });
  }

  send(message: string): Promise<ContextMessage | undefined> {
    return this.sender.send(message);
  }

  sendSelection(question: string, options: SelectionOption[], user: ContextUser): Promise<number> {
    return this.sender.sendSelection(question, options, user);
  }

  async sendEmbed(embed: EmbedMessage): Promise<ContextMessage | undefined> {
    return this.sender.sendEmbed(embed);
  }

}

export class DiscordButtonInteraction extends DiscordInteraction<ButtonInteraction> implements ContextButtonInteraction {

  private _message?: ContextMessage;

  constructor(interaction: ButtonInteraction, registry: ButtonRegistry, users: UsersDb) {
    super(interaction, registry, users);
  }

  get message(): ContextMessage {
    if (!this._message) {
      this._message = new DiscordMessage(this.interaction.message as Message);
    }
    return this._message;
  }

}

export class DiscordCommandInteraction extends DiscordInteraction<CommandInteraction> implements ContextCommandInteraction {

  constructor(interaction: CommandInteraction, private readonly parser: CommandParsingStrategy, registry: ButtonRegistry, users: UsersDb) {
    super(interaction, registry, users);
  }

  get content(): string {
    return this.interaction.commandName;
  }

  async react(): Promise<void> {
    // Do nothing since we can't react to slash commands
  }

  async delete(): Promise<void> {
    // Do nothing since slash command messages are ephemeral
  }

  async getCommand(config?: ServerDetails): Promise<ParsedCommand> {
    const command = COMMAND_MAP[this.interaction.commandName];
    if (!command) {
      throw new Error('Unrecognized command!');
    }
    const args = this.interaction.options.getString('args', false) ?? '';
    const text = `${this.interaction.commandName} ${args}`;
    let type: SyntaxType | undefined;
    if (config) {
      const dto = await config.get();
      type = dto.syntax;
    }
    return this.parser.parseCommand(removeMentions(text), this.user.permission, type);
  }

}


export class DiscordMessageInteraction implements ContextCommandInteraction {

  private _user?: ContextUser;
  private _channel?: ContextTextChannel;
  private _message?: ContextMessage;
  private _hasReplied = false;

  constructor(private readonly discordMessage: Message,
    private readonly parser: CommandParsingStrategy,
    private readonly registry: ButtonRegistry,
    private readonly users: UsersDb) {
  }

  get sendable(): boolean {
    return this.channel.sendable;
  }

  get content(): string {
    return this.discordMessage.content;
  }

  get hasReplied(): boolean {
    return this._hasReplied;
  }

  get user(): ContextUser {
    if (!this._user) {
      const permission = getPermissionLevel(this.discordMessage.author, this.discordMessage.member?.permissions);
      this._user = new DiscordUser(this.discordMessage.author, this.users, permission, this.discordMessage.member ?? undefined);
    }
    return this._user;
  }

  get channel(): ContextTextChannel {
    if (!this._channel) {
      this._channel = new DiscordTextChannel(<TextChannel | DMChannel>this.discordMessage.channel, this.registry);
    }
    return this._channel;
  }

  get message(): ContextMessage {
    if (!this._message) {
      this._message = new DiscordMessage(this.discordMessage);
    }
    return this._message;
  }

  react(emoji: string): Promise<void> {
    return this.message.react(emoji);
  }

  delete(): Promise<void> {
    return this.message.delete();
  }

  async reply(message: string): Promise<void> {
    if (this.sendable) {
      try {
        this._hasReplied = true;
        await this.discordMessage.reply(message);
      } catch (e) {
        logger.warn('Failed to reply to message: %s', e);
      }
    }
  }

  send(message: string): Promise<ContextMessage | undefined> {
    return this.channel.send(message);
  }

  sendSelection(question: string, options: SelectionOption[], user: ContextUser): Promise<number> {
    return this.channel.sendSelection(question, options, user);
  }

  sendEmbed(embed: EmbedMessage): Promise<ContextMessage | undefined> {
    return this.channel.sendEmbed(embed);
  }

  async defer(): Promise<void> {
    // Do nothing since it doesn't matter here
  }

  async getCommand(config?: ServerDetails): Promise<ParsedCommand> {
    let type: SyntaxType | undefined;
    if (config) {
      const dto = await config.get();
      type = dto.syntax;
    }
    return this.parser.parseCommand(removeMentions(this.message.text), this.user.permission, type);
  }

}

function removeMentions(text: string): string {
  return text.replace(/<(@[!&]?|#)\d+>/g, '').trim();
}