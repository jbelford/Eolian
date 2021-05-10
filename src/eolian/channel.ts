import { PERMISSION } from 'common/constants';
import { logger } from 'common/logger';
import { DMChannel, Message, MessageCollector, MessageEmbed, MessageReaction, ReactionCollector, TextChannel, User } from 'discord.js';
import { createSelectionEmbed } from 'embed';
import { DiscordMessage } from 'eolian';
import { EolianUserService } from 'services';
import { ContextMessage, ContextTextChannel, ContextUser, EmbedMessage, MessageButton, MessageButtonOnClickHandler } from './@types';
import { DiscordUser } from './user';

const numberToEmoji = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

const emojiToNumber: { [key: string]: number } = {};
for (let i = 0; i < numberToEmoji.length; ++i) {
  emojiToNumber[numberToEmoji[i]] = i;
}

const STOP_EMOJI = '🚫';

export class DiscordTextChannel implements ContextTextChannel {

  constructor(private readonly channel: TextChannel | DMChannel,
    private readonly users: EolianUserService) { }

  async send(message: string): Promise<ContextMessage> {
    const discordMessage = await this.channel.send(message);
    return new DiscordMessage(discordMessage as Message);
  }

  // Simutaneously need to accept a text input OR emoji reaction so this is a mess
  async sendSelection(question: string, options: string[], user: ContextUser): Promise<number> {
    return new Promise((resolve, reject) => {
      let sentEmbedPromise: Promise<ContextMessage>;
      let resolved = false;

      const collector = this.awaitUserSelection(user.id, options, async (msg) => {
        if (!resolved) {
          try {
            resolved = true;
            const sentEmbed = await sentEmbedPromise;
            await sentEmbed.delete();
            if (!msg) {
              resolve(-1);
            } else {
              await msg.delete();
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
          resolve(emoji === STOP_EMOJI ? -1 : emojiToNumber[emoji] - 1);
        }
        return true;
      };

      const selectEmbed = createSelectionEmbed(question, options, user.name, user.avatar);
      if (options.length <= numberToEmoji.length) {
        selectEmbed.buttons = options.map((o, i) => ({ emoji: numberToEmoji[i + 1], onClick }));
        selectEmbed.buttons.push({ emoji: STOP_EMOJI , onClick });
      }

      sentEmbedPromise = this.sendEmbed(selectEmbed);
      sentEmbedPromise.catch(reject);
    });
  }

  private awaitUserSelection(userId: string, options: string[], cb: (message: Message | undefined) => void): MessageCollector {
    const collector = this.channel.createMessageCollector((message: Message) => {
      if (message.author.id !== userId) {
        return false;
      }
      const idx = +message.content;
      return !isNaN(idx) && idx >= 0 && idx <= options.length;
    }, { max: 1, time: 60000 });

    collector.on('end', (collected) => {
      cb(collected.first());
    });

    return collector;
  }

  async sendEmbed(embed: EmbedMessage): Promise<ContextMessage> {
    const rich = new MessageEmbed();

    if (embed.color) rich.setColor(embed.color);
    if (embed.header) rich.setAuthor(embed.header.text, embed.header.icon);
    if (embed.title) rich.setTitle(embed.title);
    if (embed.description) rich.setDescription(embed.description);
    if (embed.thumbnail) rich.setThumbnail(embed.thumbnail);
    if (embed.image) rich.setImage(embed.image);
    if (embed.url) rich.setURL(embed.url);
    if (embed.footer) rich.setFooter(embed.footer.text, embed.footer.icon);

    const message = await this.channel.send(rich) as Message;
    const collector = embed.buttons ? this.addButtons(message, embed.buttons) : undefined;
    return new DiscordMessage(message, collector);
  }

  private addButtons(message: Message, buttons: MessageButton[]): ReactionCollector {
    const collector = message.createReactionCollector(
        (reaction: MessageReaction, user: User) => user.id !== message.author.id);

    collector.on('collect', async (reaction: MessageReaction, user: User) => {
      const button = buttons.find(button => button.emoji === reaction.emoji.name);
      if (!button || !button.onClick) {
        return;
      }

      let destroy = false;
      try {
        destroy = await button.onClick(new DiscordMessage(reaction.message),
            new DiscordUser(user, this.users, PERMISSION.UNKNOWN),
            button.emoji);
      } catch (e) {
        logger.warn(`Button handler threw an unhandled exception: ${e.stack || e}`);
        destroy = true;
      }

      if (destroy) collector.stop();
    });

    (async () => {
      try {
        for (const button of buttons) {
          await message.react(button.emoji);
        }
      } catch (e) {
        logger.error(`Failed to add button reaction to selection: ${e}`);
      }
    })();

    return collector;
  }

}