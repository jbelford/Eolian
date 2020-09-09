import { logger } from 'common/logger';
import { Message } from 'discord.js';
import { ContextMessage } from './@types';

export class DiscordMessage implements ContextMessage {

  constructor(private readonly message: Message) { }

  get text(): string {
    return this.message.content;
  }

  async reply(message: string): Promise<void> {
    await this.message.reply(message);
  };

  getButtons() {
    return this.message.reactions.cache.map(reaction => {
      let count = 0;
      if (reaction.count === null) {
        logger.error('[DiscordMessage::getButtons] Discord.js devs think making everything nullable is good design!');
      } else {
        count = reaction.me ? reaction.count - 1 : reaction.count;
      }

      return { emoji: reaction.emoji.name, count };
    });
  }

  async delete(): Promise<void> {
    await this.message.delete();
  }

}