import { COMMAND_MAP } from 'commands';
import { CommandParsingStrategy, ParsedCommand, SyntaxType } from 'commands/@types';
import { logger } from 'common/logger';
import { UsersDb } from 'data/@types';
import { ButtonInteraction, CommandInteraction, DMChannel, GuildMember, Message, TextChannel } from 'discord.js';
import { ContextButtonInteraction, ContextCommandInteraction, ContextInteraction, ContextInteractionOptions, ContextMessage, ContextTextChannel, ContextUser, EmbedMessageButton, ServerDetails } from './@types';
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

class DiscordInteraction<T extends ButtonInteraction | CommandInteraction> implements ContextInteraction {

  private _user?: ContextUser;
  private _channel?: ContextTextChannel;

  constructor(protected readonly interaction: T,
    private readonly registry: ButtonRegistry,
    private readonly users: UsersDb) {
  }

  get user(): ContextUser {
    if (!this._user) {
      this.interaction.memberPermissions
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

  async reply(message: string, options?: ContextInteractionOptions): Promise<void> {
    if (!this.hasReplied) {
      await this.interaction.reply({ content: message, ephemeral: options?.ephemeral });
    } else {
      await this.interaction.followUp({ content: message, ephemeral: options?.ephemeral });
    }
  }

  async defer(ephemeral?: boolean): Promise<void> {
    await this.interaction.deferReply({ ephemeral });
  }

}

export class DiscordButtonInteraction extends DiscordInteraction<ButtonInteraction> implements ContextButtonInteraction {

  private _message?: ContextMessage;

  constructor(interaction: ButtonInteraction, registry: ButtonRegistry, users: UsersDb) {
    super(interaction, registry, users);
  }

  get message(): ContextMessage {
    if (!this._message) {
      this._message = new DiscordMessage(this.interaction.message as Message, this.channel);
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
      this._message = new DiscordMessage(this.discordMessage, this.channel);
    }
    return this._message;
  }

  react(emoji: string): Promise<void> {
    return this.message.react(emoji);
  }

  delete(): Promise<void> {
    return this.message.delete();
  }

  reply(message: string): Promise<void> {
    this._hasReplied = true;
    return this.message.reply(message);
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