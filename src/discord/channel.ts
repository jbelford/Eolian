import { PERMISSION } from 'common/constants';
import { logger } from "common/logger";
import { DMChannel, GroupDMChannel, Message, MessageReaction, RichEmbed, TextChannel, User } from "discord.js";
import { DiscordMessage } from "discord/message";
import { DiscordUser } from "discord/user";
import * as embed from 'embed';
import { EolianUserService } from 'services/user';

export class DiscordTextChannel implements ContextTextChannel {

  constructor(private readonly channel: TextChannel | DMChannel | GroupDMChannel,
    private readonly users: EolianUserService) { }

  async send(message: string): Promise<ContextMessage> {
    const discordMessage = await this.channel.send(message);
    return new DiscordMessage(discordMessage as Message);
  }

  async sendSelection(question: string, options: string[], userId: string): Promise<number | undefined> {
    const selectEmbed = embed.selection(question, options);
    await this.sendEmbed(selectEmbed);

    const selection = await this.awaitUserSelection(userId, options);
    if (!selection) {
      return;
    }

    const idx = +selection.content;
    if (idx === 0) {
      await selection.reply('The selection has been cancelled.');
      return;
    }

    return idx - 1;
  }

  private async awaitUserSelection(userId: string, options: string[]): Promise<Message | undefined> {
    const messages = await this.channel.awaitMessages((message: Message) => {
      if (message.author.id !== userId) {
        return false;
      }

      const idx = +message.content;
      return !isNaN(idx) && idx >= 0 && idx <= options.length
    }, { maxMatches: 1, time: 60000 });

    return messages.size ? messages.array()[0] : undefined;
  }

  async sendEmbed(embed: EmbedMessage): Promise<ContextMessage> {
    const rich: RichEmbed = new RichEmbed();

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