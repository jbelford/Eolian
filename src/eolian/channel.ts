import { DiscordChannel, EMOJI_TO_NUMBER, NUMBER_TO_EMOJI, PERMISSION } from 'common/constants';
import { logger } from 'common/logger';
import { UsersDb } from 'data/@types';
import { MessageActionRow, MessageButton } from 'discord-buttons';
import ButtonCollector from 'discord-buttons/typings/v12/Classes/ButtonCollector';
import ButtonEvent from 'discord-buttons/typings/v12/Classes/INTERACTION_CREATE';
import { DMChannel, Message, MessageCollector, Permissions, TextChannel } from 'discord.js';
import { createSelectionEmbed } from 'embed';
import { SelectionOption } from 'embed/@types';
import { ButtonStyle, ContextMessage, ContextTextChannel, ContextUser, EmbedMessage, EmbedMessageButton, MessageButtonOnClickHandler } from './@types';
import { DiscordMessage, mapDiscordEmbed } from './message';
import { DiscordUser } from './user';

const STOP_EMOJI = '🚫';

export class DiscordTextChannel implements ContextTextChannel {

  constructor(private readonly channel: TextChannel | DMChannel,
    private readonly users: UsersDb) { }

  get lastMessageId(): string | undefined {
    return this.channel.lastMessageID || undefined;
  }

  get sendable(): boolean {
    let value = !this.channel.deleted;
    if (this.channel.type === DiscordChannel.TEXT) {
      const permissions = (this.channel as TextChannel).permissionsFor(this.channel.client.user!);
      value &&= !!permissions?.has(Permissions.FLAGS.SEND_MESSAGES);
    }
    return value;
  }

  async send(message: string): Promise<ContextMessage | undefined> {
    if (this.sendable) {
      try {
        const discordMessage = await this.channel.send(message);
        return new DiscordMessage(discordMessage as Message, this);
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

      const onClick: MessageButtonOnClickHandler = async (msg, user, emoji) => {
        if (!resolved) {
          resolved = true;
          collector.stop();
          await msg.delete();
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
    const collector = this.channel.createMessageCollector((message: Message) => {
      if (message.author.id !== userId) {
        return false;
      }
      const idx = +message.content;
      return !isNaN(idx) && idx >= 0 && idx <= count;
    }, { max: 1, time: 60000 });

    collector.once('end', (collected) => {
      cb(collected.first());
    });

    return collector;
  }

  // Using discord buttons is still very new. As such we have to use `any` type to get around this
  // When discord buttons mature and are included in base discord.js - we can refactor this
  async sendEmbed(embed: EmbedMessage): Promise<ContextMessage | undefined> {
    if (this.sendable) {
      try {
        const rich = mapDiscordEmbed(embed);
        const wrapped: ButtonWrapped[] | undefined = embed.buttons?.map(button => {
          return {
            details: button,
            component: new MessageButton()
              .setEmoji(button.emoji)
              .setStyle(buttonStyleToDiscordStyle(button.style))
              .setID(`${Date.now()}_${this.channel.id}_${button.emoji}`)
          };
        })
        let buttonRow: any[] | undefined;
        if (wrapped) {
          buttonRow = [];
          for (let i = 0; i < wrapped.length; i += 5) {
            const row = new MessageActionRow()
              .addComponent(wrapped.slice(i, i + 5).map(wrapped => wrapped.component));
            buttonRow.push(row);
          }
        }
        // @ts-ignore
        const message = await this.channel.send({ embed: rich, components: buttonRow }) as Message;
        if (embed.reactions) {
          this.addReactions(message, embed.reactions);
        }
        const collector = wrapped ? this.addButtons(message, wrapped, embed.buttonUserId) : undefined;
        return new DiscordMessage(message, this, buttonRow, collector);
      } catch (e) {
        logger.warn('Failed to send embed message: %s', e);
      }
    }
    return undefined;
  }

  private addReactions(message: Message, reactions: string[]): void {
    (async () => {
      try {
        for (const reaction of reactions) {
          if (!message.deleted) {
            await message.react(reaction);
          }
        }
      } catch (e) {
        logger.warn(`Failed to add button reaction to selection: %s`, e);
      }
    })();
  }

  private addButtons(message: Message, buttons: ButtonWrapped[], userId?: string): ButtonCollector {
    const buttonMap: { [key:string]: ButtonWrapped } = {};
    buttons.forEach(button => buttonMap[button.component.custom_id] = button);

    // @ts-ignore
    const collector: ButtonCollector = message.createButtonCollector((button: ButtonEvent) =>
      button.clicker.user.id !== message.author.id
      && (!userId || userId === button.clicker.user.id)
      && button.id in buttonMap
      && !!buttonMap[button.id].details.onClick,
      { time: 60000 * 60 * 2 });

    const buttonClickEventHandler = async (button: ButtonEvent) => {
        const wrapped = buttonMap[button.id];

        let destroy = false;
        try {
          destroy = await wrapped.details.onClick!(new DiscordMessage(message, this),
              new DiscordUser(button.clicker.user, this.users, PERMISSION.UNKNOWN),
              wrapped.details.emoji);
        } catch (e) {
          logger.warn(`Button handler threw an unhandled exception: ${e.stack || e}`);
          destroy = true;
        }

        if (destroy) {
          collector.stop();
        } else {
          await button.defer();
        }

      };

    collector.on('collect', buttonClickEventHandler);

    collector.once('end', () => {
      collector.removeListener('collect', buttonClickEventHandler);
      collector.removeListener('remove', buttonClickEventHandler);
    });

    return collector;
  }

}

interface ButtonWrapped {
  details: EmbedMessageButton,
  component: any
}

function buttonStyleToDiscordStyle(style = ButtonStyle.SECONDARY) {
  return style + 1;
}