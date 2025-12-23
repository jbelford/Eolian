import {
  MessageComponentInteraction,
  CommandInteraction,
  BaseMessageOptions,
  Message,
  MessageFlags,
} from 'discord.js';
import { DiscordMessageSender } from '../discord-sender';

export class DiscordInteractionSender implements DiscordMessageSender {
  constructor(private readonly interaction: MessageComponentInteraction | CommandInteraction) {}

  async send(options: BaseMessageOptions, forceEphemeral?: boolean): Promise<Message> {
    const hasButtons = !!options.components?.length;
    const ephemeral = hasButtons ? false : (forceEphemeral ?? true);
    const flags = ephemeral ? MessageFlags.Ephemeral : undefined;
    let reply: Message;
    if (!this.interaction.replied) {
      if (!this.interaction.deferred) {
        const response = await this.interaction.reply({
          ...options,
          flags,
          withResponse: true,
        });
        if (!response.resource?.message) {
          throw new Error('No response resource from interaction reply');
        }
        reply = response.resource.message;
      } else {
        if (this.interaction.ephemeral && hasButtons) {
          throw new Error('Buttons on ephemeral message are not allowed');
        }
        reply = await this.interaction.editReply(options);
      }
    } else {
      reply = await this.interaction.followUp({
        ...options,
        flags,
        withResponse: true,
      });
    }
    return reply;
  }
}
