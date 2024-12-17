import { UsersDb } from '@eolian/data/@types';
import { ButtonInteraction, Message } from 'discord.js';
import { ContextButtonInteraction, ContextMessage, IAuthServiceProvider } from '../@types';
import { ButtonRegistry } from '../button-registry';
import { DiscordInteraction } from './discord-interaction';
import { DiscordMessage } from '../discord-message';

export class DiscordButtonInteraction
  extends DiscordInteraction<ButtonInteraction>
  implements ContextButtonInteraction
{
  private _message?: ContextMessage;

  constructor(
    interaction: ButtonInteraction,
    registry: ButtonRegistry,
    users: UsersDb,
    auth: IAuthServiceProvider,
  ) {
    super(interaction, registry, users, auth);
  }

  get message(): ContextMessage {
    if (!this._message) {
      this._message = new DiscordMessage(this.interaction.message as Message, {
        registry: this.registry,
        components: this.interaction.message.components,
        interaction: this.interaction,
      });
    }
    return this._message;
  }

  async deferUpdate(): Promise<void> {
    await this.interaction.deferUpdate();
  }
}
