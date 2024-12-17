import { ICommandOptionProvider } from '@eolian/commands/@types';
import { ChatInputCommandInteraction } from 'discord.js';

export class DiscordInteractionOptionProvider implements ICommandOptionProvider {
  constructor(private readonly interaction: ChatInputCommandInteraction) {}

  getBoolean(name: string): boolean | undefined {
    return this.interaction.options.getBoolean(name) ?? undefined;
  }

  getString(name: string): string | undefined {
    return this.interaction.options.getString(name) ?? undefined;
  }
}
