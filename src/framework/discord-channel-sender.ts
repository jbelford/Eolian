import { EMOJI_TO_NUMBER, NUMBER_TO_EMOJI } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { logger } from '@eolian/common/logger';
import { createSelectionEmbed } from '@eolian/embed';
import { SelectionOption } from '@eolian/embed/@types';
import {
  Message,
  TextChannel,
  DMChannel,
  ChannelType,
  PermissionFlagsBits,
  MessageCollector,
  VoiceChannel,
} from 'discord.js';
import {
  ContextInteractionOptions,
  ContextMessage,
  EmbedMessage,
  ContextSendable,
  ContextUser,
  SelectionResult,
  MessageButtonOnClickHandler,
} from './@types';
import { ButtonRegistry } from './button-registry';
import { DiscordMessageSender, DiscordSender } from './discord-sender';

const STOP_EMOJI = '🚫';

export type SupportedTextChannel = TextChannel | DMChannel | VoiceChannel;

export class DiscordChannelSender implements ContextSendable {
  private readonly sender: DiscordSender;
  private _sendable?: boolean;

  constructor(
    messageSender: DiscordMessageSender,
    registry: ButtonRegistry,
    private readonly textChannel: SupportedTextChannel,
  ) {
    this.sender = new DiscordSender(messageSender, registry);
  }

  get sendable(): boolean {
    if (this._sendable === undefined) {
      this._sendable = true;
      if (this.textChannel.type !== ChannelType.DM) {
        const permissions = this.textChannel.permissionsFor(this.textChannel.guild.members.me!);
        this._sendable &&= !!permissions?.has(
          PermissionFlagsBits.ViewChannel |
            PermissionFlagsBits.SendMessages |
            PermissionFlagsBits.EmbedLinks |
            PermissionFlagsBits.ReadMessageHistory,
        );
      }
    }
    return this._sendable;
  }

  async send(
    message: string,
    options?: ContextInteractionOptions,
  ): Promise<ContextMessage | undefined> {
    if (this.sendable || options?.force) {
      return await this.sender.send(message, options);
    }
    return undefined;
  }

  async sendEmbed(
    embed: EmbedMessage,
    options?: ContextInteractionOptions,
  ): Promise<ContextMessage | undefined> {
    if (this.sendable) {
      return await this.sender.sendEmbed(embed, options);
    }
    return undefined;
  }

  async sendSelection(
    question: string,
    options: SelectionOption[],
    user: ContextUser,
  ): Promise<SelectionResult> {
    if (this.sendable) {
      const result = await this._sendSelection(question, options, user);
      if (result) {
        if (result.selected < 0) {
          throw new EolianUserError('Nothing selected 😢', result.message);
        }
        return result;
      }
    }
    throw new Error('Failed to send selection message');
  }

  // Simutaneously need to accept a text input OR emoji reaction so this is a mess
  private _sendSelection(
    question: string,
    options: SelectionOption[],
    user: ContextUser,
  ): Promise<SelectionResult | undefined> {
    return new Promise((resolve, reject) => {
      let resolved = false;

      const collector = this.awaitUserSelection(user.id, options.length, async msg => {
        if (!resolved) {
          try {
            resolved = true;
            const sentEmbed = await sentEmbedPromise;
            if (!sentEmbed) {
              logger.warn('Collector expected selection embed message but missing');
              return;
            }
            sentEmbed.releaseButtons();
            if (!msg) {
              resolve({ message: sentEmbed, selected: -1 });
            } else {
              if (msg.deletable) {
                await msg.delete();
              }
              resolve({ message: sentEmbed, selected: +msg.content - 1 });
            }
          } catch (e) {
            reject(e);
          }
        }
      });

      const onClick: MessageButtonOnClickHandler = async (interaction, emoji) => {
        if (!resolved) {
          resolved = true;
          const sentEmbed = await sentEmbedPromise;
          if (sentEmbed) {
            collector.stop();
            const selected = emoji === STOP_EMOJI ? -1 : EMOJI_TO_NUMBER[emoji] - 1;
            resolve({ message: interaction.message, selected });
          } else {
            logger.warn('Button handler expected selection embed message but missing');
          }
        }
        return true;
      };

      const selectEmbed = createSelectionEmbed(question, options, user.name, user.avatar);
      if (options.length < NUMBER_TO_EMOJI.length) {
        selectEmbed.buttons = options.map((o, i) => ({
          emoji: NUMBER_TO_EMOJI[i + 1],
          userId: user.id,
          onClick,
        }));
        selectEmbed.buttons.push({ emoji: STOP_EMOJI, userId: user.id, onClick });
      }

      const sentEmbedPromise = this.sendEmbed(selectEmbed).then(message => {
        if (!message) {
          resolved = true;
          collector.stop();
          resolve(undefined);
        }
        return message;
      });
    });
  }

  private awaitUserSelection(
    userId: string,
    count: number,
    cb: (message: Message | undefined) => void,
  ): MessageCollector {
    const collector = this.textChannel.createMessageCollector({
      filter(message: Message) {
        if (message.author.id !== userId) {
          return false;
        }
        const idx = +message.content;
        return !isNaN(idx) && idx >= 0 && idx <= count;
      },
      max: 1,
      time: 60000,
    });

    collector.once('end', collected => {
      cb(collected.first());
    });

    return collector;
  }
}
