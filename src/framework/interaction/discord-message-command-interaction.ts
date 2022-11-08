import { matchPatterns } from '@eolian/command-options';
import { CommandOptions } from '@eolian/command-options/@types';
import { MESSAGE_COMMANDS } from '@eolian/commands';
import { ParsedCommand } from '@eolian/commands/@types';
import { UsersDb } from '@eolian/data/@types';
import { MessageContextMenuCommandInteraction, Message } from 'discord.js';
import { ContextCommandInteraction, IAuthServiceProvider } from '../@types';
import { ButtonRegistry } from '../button-registry';
import { DiscordInteraction } from './discord-interaction';

export class DiscordMessageCommandInteraction
  extends DiscordInteraction<MessageContextMenuCommandInteraction>
  implements ContextCommandInteraction
{

  readonly isSlash = true;
  readonly reactable = false;
  private _message?: Message;

  constructor(
    interaction: MessageContextMenuCommandInteraction,
    registry: ButtonRegistry,
    users: UsersDb,
    auth: IAuthServiceProvider
  ) {
    super(interaction, registry, users, auth);
  }

  private get message(): Message {
    if (!this._message) {
      this._message = this.interaction.targetMessage as Message;
    }
    return this._message;
  }

  async react(): Promise<void> {
    // Do nothing since we can't react to this command
  }

  async getCommand(): Promise<ParsedCommand> {
    const command = MESSAGE_COMMANDS.safeGet(this.interaction.commandName, this.user.permission);

    const options: CommandOptions = {};
    const patternSet = new Set<string>(command.patterns?.map(p => p.name));
    matchPatterns(this.message.content, this.user.permission, patternSet, options);

    return { command, options };
  }

  toString(): string {
    return `(${this.interaction.commandName}) ${this.message.content}`;
  }

}
