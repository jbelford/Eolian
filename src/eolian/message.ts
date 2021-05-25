import { logger } from 'common/logger';
import { Message, MessageEmbed, ReactionCollector } from 'discord.js';
import { ContextMessage, ContextMessageButton, EmbedMessage } from './@types';

export class DiscordMessage implements ContextMessage {

  constructor(private readonly message: Message, private readonly collector?: ReactionCollector) { }

  get text(): string {
    return this.message.content;
  }

  get id(): string {
    return this.message.id;
  }

  async reply(message: string): Promise<void> {
    await this.message.reply(message);
  }

  async react(emoji: string): Promise<void> {
    await this.message.react(emoji);
  }

  async edit(message: string): Promise<void> {
    await this.message.edit(message);
  }

  async editEmbed(embed: EmbedMessage): Promise<void> {
    const rich = mapDiscordEmbed(embed);
    await this.message.edit(rich);
  }

  getButtons(): ContextMessageButton[] {
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

  releaseButtons(): void {
    if (this.collector) {
      this.collector.stop();
    }
  }

  async delete(): Promise<void> {
    this.releaseButtons();
    if (this.message.deletable) {
      await this.message.delete();
    } else if (this.message.author.id === this.message.client.user?.id) {
      logger.warn(`Failed to delete message created by ourself`)
    }
  }

}

export function mapDiscordEmbed(embed: EmbedMessage): MessageEmbed {
  const rich = new MessageEmbed();

  if (embed.color)
    rich.setColor(embed.color);
  if (embed.header)
    rich.setAuthor(embed.header.text, embed.header.icon);
  if (embed.title)
    rich.setTitle(clampLength(embed.title, 256));
  if (embed.description)
    rich.setDescription(clampLength(embed.description, 2048));
  if (embed.thumbnail)
    rich.setThumbnail(embed.thumbnail);
  if (embed.image)
    rich.setImage(embed.image);
  if (embed.url)
    rich.setURL(embed.url);
  if (embed.footer)
    rich.setFooter(clampLength(embed.footer.text, 2048), embed.footer.icon);
  if (embed.fields) {
    const fields = embed.fields.slice(0, 25)
      .map(f => ({ name: clampLength(f.name, 256), value: clampLength(f.value, 1024) }));
    rich.addFields(fields);
  }
  return rich;
}


function clampLength(str: string, length: number) {
  if (str.length > length) {
    str = str.substring(0, length - 2);
    str += '..';
  }
  return str;
}
