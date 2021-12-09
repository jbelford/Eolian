import { EMOJI_TO_NUMBER, NUMBER_TO_EMOJI } from 'common/constants';
import { logger } from 'common/logger';
import { DMChannel, Message, MessageCollector, MessageOptions, Permissions, TextChannel } from 'discord.js';
import { createSelectionEmbed } from 'embed';
import { SelectionOption } from 'embed/@types';
import { ContextMessage, ContextTextChannel, ContextUser, EmbedMessage, MessageButtonOnClickHandler } from './@types';
import { ButtonRegistry } from "./button";
import { DiscordButtonMapping, DiscordMessage, DiscordMessageButtons, mapDiscordEmbed, mapDiscordEmbedButtons } from './message';

export const STOP_EMOJI = '🚫';

export interface DiscordMessageSender {
  send(options: MessageOptions): Promise<Message>;
}

export class DiscordSender {

  private _sendable?: boolean;

  constructor(private readonly sender: DiscordMessageSender,
    private readonly registry: ButtonRegistry,
    private readonly channel: TextChannel | DMChannel) {
  }

  get sendable(): boolean {
    if (this._sendable === undefined) {
      this._sendable = !this.channel.deleted;
      if (this.channel.type === 'GUILD_TEXT') {
        const permissions = (this.channel as TextChannel).permissionsFor((this.channel as TextChannel).guild.me!);
        this._sendable &&= !!permissions?.has(Permissions.FLAGS.SEND_MESSAGES | Permissions.FLAGS.EMBED_LINKS | Permissions.FLAGS.READ_MESSAGE_HISTORY);
      }
    }
    return this._sendable;
  }

  async send(message: string): Promise<ContextMessage | undefined> {
    if (this.sendable) {
      try {
        const discordMessage = await this.sender.send({ content: message });
        return new DiscordMessage(discordMessage);
      } catch (e) {
        logger.warn('Failed to send message: %s', e);
      }
    }
    return undefined;
  }

  // Simutaneously need to accept a text input OR emoji reaction so this is a mess
  async sendSelection(question: string, options: SelectionOption[], user: ContextUser): Promise<number> {
    if (!this.sendable) {
      return -1;
    }

    return new Promise((resolve, reject) => {
      let resolved = false;

      const collector = this.awaitUserSelection(user.id, options.length, async (msg) => {
        if (!resolved) {
          try {
            resolved = true;
            if (sentEmbedPromise) {
              const sentEmbed = await sentEmbedPromise;
              if (sentEmbed) {
                await sentEmbed.delete();
              }
            }
            if (!msg) {
              resolve(-1);
            } else {
              if (msg.deletable) {
                await msg.delete();
              }
              const idx = +msg.content;
              resolve(idx - 1);
            }
          } catch (e) {
            reject(e);
          }
        }
      });

      const onClick: MessageButtonOnClickHandler = async (interaction, emoji) => {
        if (!resolved) {
          resolved = true;
          collector.stop();
          await interaction.message.delete();
          resolve(emoji === STOP_EMOJI ? -1 : EMOJI_TO_NUMBER[emoji] - 1);
        }
        return true;
      };

      const selectEmbed = createSelectionEmbed(question, options, user.name, user.avatar);
      if (options.length < NUMBER_TO_EMOJI.length) {
        selectEmbed.buttons = options.map((o, i) => ({ emoji: NUMBER_TO_EMOJI[i + 1], onClick }));
        selectEmbed.buttons.push({ emoji: STOP_EMOJI , onClick });
        selectEmbed.buttonUserId = user.id;
      }

      const sentEmbedPromise = this.sendEmbed(selectEmbed);
      sentEmbedPromise.catch(reject);
    });
  }

  private awaitUserSelection(userId: string, count: number, cb: (message: Message | undefined) => void): MessageCollector {
    const collector = this.channel.createMessageCollector({
      filter(message: Message) {
        if (message.author.id !== userId) {
          return false;
        }
        const idx = +message.content;
        return !isNaN(idx) && idx >= 0 && idx <= count;
      },
      max: 1,
      time: 60000
    });

    collector.once('end', (collected) => {
      cb(collected.first());
    });

    return collector;
  }

  async sendEmbed(embed: EmbedMessage): Promise<ContextMessage | undefined> {
    if (this.sendable) {
      try {
        const rich = mapDiscordEmbed(embed);

        const messageOptions: MessageOptions = { embeds: [rich] };

        let buttonMapping: DiscordButtonMapping | undefined;
        if (embed.buttons) {
          buttonMapping = mapDiscordEmbedButtons(embed.buttons);
          messageOptions.components = buttonMapping.rows;
        }

        const message = await this.sender.send(messageOptions);

        let msgButtons: DiscordMessageButtons | undefined;
        if (buttonMapping) {
          this.registry.register(message.id, buttonMapping.mapping);
          msgButtons = { registry: this.registry, components: buttonMapping.rows };
        }

        return new DiscordMessage(message, msgButtons);
      } catch (e) {
        logger.warn('Failed to send embed message: %s', e);
      }
    }
    return undefined;
  }

}

export class DiscordTextChannel implements ContextTextChannel {

  private readonly sender: DiscordSender;

  constructor(private readonly channel: TextChannel | DMChannel,
      private readonly registry: ButtonRegistry) {
    this.sender = new DiscordSender(channel, this.registry, this.channel);
  }

  get lastMessageId(): string | undefined {
    return this.channel.lastMessageId || undefined;
  }

  get isDm(): boolean {
    return this.channel.type === 'DM';
  }

  get sendable(): boolean {
    return this.sender.sendable;
  }

  send(message: string): Promise<ContextMessage | undefined> {
    return this.sender.send(message);
  }

  // Simutaneously need to accept a text input OR emoji reaction so this is a mess
  sendSelection(question: string, options: SelectionOption[], user: ContextUser): Promise<number> {
    return this.sender.sendSelection(question, options, user);
  }

  sendEmbed(embed: EmbedMessage): Promise<ContextMessage | undefined> {
    return this.sender.sendEmbed(embed);
  }

}