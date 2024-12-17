import {
  MessageComponentInteraction,
  CommandInteraction,
  BaseMessageOptions,
  Message,
} from 'discord.js';
import { DiscordMessageSender } from '../discord-sender';

export class DiscordInteractionSender implements DiscordMessageSender {
  constructor(private readonly interaction: MessageComponentInteraction | CommandInteraction) {}

  async send(options: BaseMessageOptions, forceEphemeral?: boolean): Promise<Message> {
    const hasButtons = !!options.components?.length;
    const ephemeral = hasButtons ? false : (forceEphemeral ?? true);
    let reply: Message;
    if (!this.interaction.replied) {
      if (!this.interaction.deferred) {
        reply = (await this.interaction.reply({
          ...options,
          ephemeral,
          fetchReply: true,
        })) as Message;
      } else {
        if (this.interaction.ephemeral && hasButtons) {
          throw new Error('Buttons on ephemeral message are not allowed');
        }
        reply = (await this.interaction.editReply(options)) as Message;
      }
    } else {
      reply = (await this.interaction.followUp({
        ...options,
        ephemeral,
        fetchReply: true,
      })) as Message;
    }
    return reply;
  }
}
