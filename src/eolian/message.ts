import { logger } from 'common/logger';
import ButtonCollector from 'discord-buttons/typings/v12/Classes/ButtonCollector';
import { Message, MessageEditOptions, MessageEmbed } from 'discord.js';
import { ContextMessage, ContextMessageReaction, ContextTextChannel, EmbedMessage } from './@types';

export class DiscordMessage implements ContextMessage {

  constructor(private readonly message: Message,
    private readonly channel: ContextTextChannel,
    private readonly buttons?: any[],
    private readonly collector?: ButtonCollector) { }

  get text(): string {
    return this.message.content;
  }

  get id(): string {
    return this.message.id;
  }

  async reply(message: string): Promise<void> {
    if (this.channel.sendable) {
      try {
        await this.message.reply(message);
      } catch (e) {
        logger.warn('Failed to reply to message: %s', e);
      }
    }
  }

  async react(emoji: string): Promise<void> {
    if (!this.message.deleted) {
      try {
        await this.message.react(emoji);
      } catch (e) {
        logger.warn('Failed to react to message: %s', e);
      }
    }
  }

  async edit(message: string): Promise<void> {
    await this.editMessage(message);
  }

  async editEmbed(embed: EmbedMessage): Promise<void> {
    const rich = mapDiscordEmbed(embed);
    await this.editMessage(rich);
  }

  private async editMessage(message: string | MessageEmbed) : Promise<void> {
    if (this.message.editable) {
      try {
        const options: MessageEditOptions = { };
        if (typeof message === 'string') {
          options.content = message;
        } else {
          options.embed = message;
        }
        if (this.buttons) {
          // @ts-ignore
          options.components = this.buttons;
        }
        await this.message.edit(options);
      } catch (e) {
        logger.warn('Failed to edit message: %s', e);
      }
    }
  }

  getReactions(): ContextMessageReaction[] {
    return this.message.reactions.cache.map(reaction => {
      let count = 0;
      if (reaction.count === null) {
        logger.warn('Reaction count was found to be null');
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
    if (!this.message.deleted) {
      if (this.message.deletable) {
        try {
          await this.message.delete();
        } catch (e) {
          logger.warn('Failed to delete message: %s', e);
        }
      } else if (this.message.author.id === this.message.client.user?.id) {
        logger.warn(`Failed to delete message created by ourself`)
      }
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
