import { logger } from 'common/logger';
import {
  ButtonInteraction,
  Message,
  MessageActionRow,
  MessageButton,
  MessageEditOptions,
  MessageEmbed,
} from 'discord.js';
import { ButtonStyle, ContextMessage, EmbedMessage, EmbedMessageButton } from './@types';
import { ButtonRegistry } from './button';

export interface DiscordMessageButtons {
  registry: ButtonRegistry;
  components: MessageActionRow[];
  interaction?: ButtonInteraction;
}

export class DiscordMessage implements ContextMessage {
  constructor(
    private readonly message: Message,
    private readonly buttons?: DiscordMessageButtons
  ) {}

  get text(): string {
    return this.message.content;
  }

  get id(): string {
    return this.message.id;
  }

  get editable(): boolean {
    return this.buttons?.interaction ? true : this.message.editable;
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
    if (embed.buttons && this.buttons) {
      const buttonMapping = mapDiscordEmbedButtons(embed.buttons);
      this.buttons.components = buttonMapping.rows;
      this.buttons.registry.register(this.id, buttonMapping.mapping);
    }
    await this.editMessage(rich);
  }

  private async editMessage(message: string | MessageEmbed): Promise<void> {
    if (this.editable) {
      try {
        const options: MessageEditOptions = {};
        if (typeof message === 'string') {
          options.content = message;
          options.embeds = [];
        } else {
          options.embeds = [message];
        }
        options.components = this.buttons ? this.buttons.components : [];
        logger.debug('Editing message %s', this.message.id);
        if (this.buttons?.interaction) {
          await this.buttons.interaction.update(options);
        } else {
          await this.message.edit(options);
        }
      } catch (e) {
        logger.warn('Failed to edit message: %s', e);
      }
    }
  }

  releaseButtons(): void {
    if (this.buttons) {
      this.buttons.registry.unregister(this.id);
      this.buttons.components = [];
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
        logger.warn(`Failed to delete message created by ourself`);
      }
    }
  }
}

export function mapDiscordEmbed(embed: EmbedMessage): MessageEmbed {
  const rich = new MessageEmbed();

  if (embed.color) rich.setColor(embed.color);
  if (embed.header) rich.setAuthor(embed.header.text, embed.header.icon);
  if (embed.title) rich.setTitle(clampLength(embed.title, 256));
  if (embed.description) rich.setDescription(clampLength(embed.description, 2048));
  if (embed.thumbnail) rich.setThumbnail(embed.thumbnail);
  if (embed.image) rich.setImage(embed.image);
  if (embed.url) rich.setURL(embed.url);
  if (embed.footer) rich.setFooter(clampLength(embed.footer.text, 2048), embed.footer.icon);
  if (embed.fields) {
    const fields = embed.fields
      .slice(0, 25)
      .map(f => ({ name: clampLength(f.name, 256), value: clampLength(f.value, 1024) }));
    rich.addFields(fields);
  }
  return rich;
}

export interface DiscordButtonMapping {
  rows: MessageActionRow[];
  mapping: Map<string, EmbedMessageButton>;
}

export function mapDiscordEmbedButtons(buttons: EmbedMessageButton[]): DiscordButtonMapping {
  const buttonMap = new Map<string, EmbedMessageButton>();
  const buttonRows: MessageActionRow[] = [];

  const messageButtons = buttons.map((button, idx) => {
    const id = `button_${idx}`;
    buttonMap.set(id, button);
    return new MessageButton()
      .setEmoji(button.emoji)
      .setDisabled(!!button.disabled)
      .setStyle(buttonStyleToDiscordStyle(button.style))
      .setCustomId(id);
  });

  for (let i = 0; i < buttons.length; i += 5) {
    const row = new MessageActionRow().addComponents(...messageButtons.slice(i, i + 5));
    buttonRows.push(row);
  }

  return { rows: buttonRows, mapping: buttonMap };
}

function clampLength(str: string, length: number) {
  if (str.length > length) {
    str = str.substring(0, length - 2);
    str += '..';
  }
  return str;
}

function buttonStyleToDiscordStyle(style = ButtonStyle.SECONDARY) {
  return style + 1;
}
