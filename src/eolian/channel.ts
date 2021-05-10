import { PERMISSION } from 'common/constants';
import { logger } from 'common/logger';
import { DMChannel, Message, MessageEmbed, MessageReaction, TextChannel, User } from 'discord.js';
import { createSelectionEmbed } from 'embed';
import { DiscordMessage } from 'eolian';
import { EolianUserService } from 'services';
import { ContextMessage, ContextTextChannel, EmbedMessage, MessageButton } from './@types';
import { DiscordUser } from './user';

export class DiscordTextChannel implements ContextTextChannel {

  constructor(private readonly channel: TextChannel | DMChannel,
    private readonly users: EolianUserService) { }

  async send(message: string): Promise<ContextMessage> {
    const discordMessage = await this.channel.send(message);
    return new DiscordMessage(discordMessage as Message);
  }

  async sendSelection(question: string, options: string[], userId: string): Promise<number> {
    const selectEmbed = createSelectionEmbed(question, options);
    await this.sendEmbed(selectEmbed);

    const selection = await this.awaitUserSelection(userId, options);
    if (!selection) {
      return -1;
    }

    const idx = +selection.content;
    return idx - 1;
  }

  private async awaitUserSelection(userId: string, options: string[]): Promise<Message | undefined> {
    const messages = await this.channel.awaitMessages((message: Message) => {
      if (message.author.id !== userId) {
        return false;
      }

      const idx = +message.content;
      return !isNaN(idx) && idx >= 0 && idx <= options.length
    }, { max: 1, time: 60000 });

    return messages.size ? messages.array()[0] : undefined;
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
    if (embed.buttons) await this.addButtons(message, embed.buttons);
    return new DiscordMessage(message);
  }

  private async addButtons(message: Message, buttons: MessageButton[]): Promise<void> {
    for (const button of buttons) {
      await message.react(button.emoji);
    }

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
            new DiscordUser(user, this.users, PERMISSION.UNKNOWN))
      } catch (e) {
        logger.warn(`Button handler threw an unhandled exception: ${e.stack || e}`);
        destroy = true;
      }

      if (destroy) collector.stop();
    });
  }

}