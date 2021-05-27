import { EMOJI_TO_NUMBER, NUMBER_TO_EMOJI, PERMISSION } from 'common/constants';
import { logger } from 'common/logger';
import { UsersDb } from 'data/@types';
import { DMChannel, Message, MessageCollector, MessageReaction, ReactionCollector, TextChannel, User } from 'discord.js';
import { createSelectionEmbed } from 'embed';
import { SelectionOption } from 'embed/@types';
import { DiscordMessage } from 'eolian';
import { ContextMessage, ContextTextChannel, ContextUser, EmbedMessage, MessageButton, MessageButtonOnClickHandler } from './@types';
import { mapDiscordEmbed } from './message';
import { DiscordUser } from './user';

const STOP_EMOJI = '🚫';

export class DiscordTextChannel implements ContextTextChannel {

  constructor(private readonly channel: TextChannel | DMChannel,
    private readonly users: UsersDb) { }

  get lastMessageId(): string | undefined {
    return this.channel.lastMessageID || undefined;
  }

  async send(message: string): Promise<ContextMessage> {
    const discordMessage = await this.channel.send(message);
    return new DiscordMessage(discordMessage as Message);
  }

  // Simutaneously need to accept a text input OR emoji reaction so this is a mess
  async sendSelection(question: string, options: SelectionOption[], user: ContextUser): Promise<number> {
    return new Promise((resolve, reject) => {
      let resolved = false;

      const collector = this.awaitUserSelection(user.id, options.length, async (msg) => {
        if (!resolved) {
          try {
            resolved = true;
            if (sentEmbedPromise) {
              const sentEmbed = await sentEmbedPromise;
              await sentEmbed.delete();
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

  async sendEmbed(embed: EmbedMessage): Promise<ContextMessage> {
    const rich = mapDiscordEmbed(embed);
    const message = await this.channel.send(rich) as Message;
    const collector = embed.buttons ? this.addButtons(message, embed.buttons, embed.buttonUserId) : undefined;
    return new DiscordMessage(message, collector);
  }

  private addButtons(message: Message, buttons: MessageButton[], userId?: string): ReactionCollector {
    const buttonMap: { [key:string]: MessageButton } = {};
    buttons.forEach(button => buttonMap[button.emoji] = button);

    const collector = message.createReactionCollector((reaction: MessageReaction, user: User) =>
      user.id !== message.author.id
      && (!userId || userId === user.id)
      && reaction.emoji.name in buttonMap
      && !!buttonMap[reaction.emoji.name].onClick,
      { idle: 60000 * 15, dispose: true });

    const reactionEventHandler = async (reaction: MessageReaction, user: User) => {
        const button = buttonMap[reaction.emoji.name];

        let destroy = false;
        try {
          destroy = await button.onClick!(new DiscordMessage(reaction.message),
              new DiscordUser(user, this.users, PERMISSION.UNKNOWN),
              button.emoji);
        } catch (e) {
          logger.warn(`Button handler threw an unhandled exception: ${e.stack || e}`);
          destroy = true;
        }

        if (destroy) collector.stop();
      };

    collector.on('collect', reactionEventHandler);
    collector.on('remove', reactionEventHandler);

    collector.once('end', () => {
      collector.removeListener('collect', reactionEventHandler);
      collector.removeListener('remove', reactionEventHandler);
    });

    (async () => {
      try {
        for (const button of buttons) {
          await message.react(button.emoji);
        }
      } catch (e) {
        logger.warn(`Failed to add button reaction to selection: ${e}`);
      }
    })();

    return collector;
  }

}
