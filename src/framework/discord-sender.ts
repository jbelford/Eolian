import { logger } from '@eolian/common/logger';
import { clampLength } from '@eolian/common/util';
import { BaseMessageOptions, Message } from 'discord.js';
import { ContextInteractionOptions, ContextMessage, EmbedMessage } from './@types';
import { ButtonRegistry } from './button-registry';
import {
  DiscordMessage,
  mapDiscordEmbed,
  DiscordButtonMapping,
  mapDiscordEmbedButtons,
  DiscordMessageButtons,
} from './discord-message';

export interface DiscordMessageSender {
  send(options: BaseMessageOptions, forceEphemeral?: boolean): Promise<Message>;
}

export const DISCORD_CONTENT_MAX = 2000;

export class DiscordSender {
  constructor(
    private readonly sender: DiscordMessageSender,
    private readonly registry?: ButtonRegistry,
  ) {}

  async send(
    message: string,
    options?: ContextInteractionOptions,
  ): Promise<ContextMessage | undefined> {
    try {
      const discordMessage = await this.sender.send(
        { content: clampLength(message, DISCORD_CONTENT_MAX) },
        options?.ephemeral,
      );
      return new DiscordMessage(discordMessage);
    } catch (e) {
      logger.warn('Failed to send message: %s', e);
    }
    return undefined;
  }

  async sendEmbed(
    embed: EmbedMessage,
    options?: ContextInteractionOptions,
  ): Promise<ContextMessage | undefined> {
    try {
      const rich = mapDiscordEmbed(embed);

      const messageOptions: BaseMessageOptions = { embeds: [rich] };

      let buttonMapping: DiscordButtonMapping | undefined;
      if (embed.buttons && this.registry) {
        buttonMapping = mapDiscordEmbedButtons(embed.buttons);
        messageOptions.components = buttonMapping.rows;
      }

      const message = await this.sender.send(messageOptions, options?.ephemeral);

      let msgButtons: DiscordMessageButtons | undefined;
      if (buttonMapping && this.registry) {
        this.registry.register(message.id, buttonMapping.mapping);
        msgButtons = { registry: this.registry, components: buttonMapping.rows };
      }

      return new DiscordMessage(message, msgButtons);
    } catch (e) {
      logger.warn('Failed to send embed message: %s', e);
    }
    return undefined;
  }
}
