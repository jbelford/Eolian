import { ParsedCommand } from '@eolian/commands/@types';
import { UsersDb } from '@eolian/data/@types';
import { ChatInputCommandInteraction } from 'discord.js';
import { ContextCommandInteraction, IAuthServiceProvider } from '../@types';
import { ButtonRegistry } from '../button-registry';
import { DiscordInteraction } from './discord-interaction';
import { COMMANDS, SlashCommandOptionParser } from '@eolian/commands';
import { DiscordInteractionOptionProvider } from './discord-interaction-option-provider';

export class DiscordCommandInteraction
  extends DiscordInteraction<ChatInputCommandInteraction>
  implements ContextCommandInteraction
{
  readonly isSlash = true;

  constructor(
    interaction: ChatInputCommandInteraction,
    registry: ButtonRegistry,
    users: UsersDb,
    auth: IAuthServiceProvider,
  ) {
    super(interaction, registry, users, auth);
  }

  get content(): string {
    return this.interaction.toString();
  }

  get reactable(): boolean {
    return false;
  }

  async react(): Promise<void> {
    // Do nothing since we can't react to slash commands
  }

  async getCommand(): Promise<ParsedCommand> {
    const command = COMMANDS.safeGet(this.interaction.commandName, this.user.permission);
    const options = new SlashCommandOptionParser(
      command,
      new DiscordInteractionOptionProvider(this.interaction),
      this.user.permission,
    ).resolve();
    return { command, options };
  }

  toString(): string {
    return this.interaction.toString();
  }
}
