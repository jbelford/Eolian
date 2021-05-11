import { logger } from 'common/logger';
import { Message, ReactionCollector } from 'discord.js';
import { ContextMessage } from './@types';

export class DiscordMessage implements ContextMessage {

  constructor(private readonly message: Message, private readonly collector?: ReactionCollector) { }

  get text(): string {
    return this.message.content;
  }

  async reply(message: string): Promise<void> {
    await this.message.reply(message);
  };

  async react(emoji: string): Promise<void> {
    await this.message.react(emoji);
  }

  async edit(message: string): Promise<void> {
    await this.message.edit(message);
  }

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

  releaseButtons() {
    if (this.collector) {
      this.collector.stop();
    }
  }

  async delete(): Promise<void> {
    await this.message.delete();
  }

}