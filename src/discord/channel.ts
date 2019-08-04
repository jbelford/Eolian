import { PERMISSION } from 'common/constants';
import { Embed } from "common/embed";
import { logger } from "common/logger";
import { DMChannel, GroupDMChannel, Message, MessageReaction, RichEmbed, TextChannel, User } from "discord.js";
import { DiscordMessage } from "discord/message";
import { DiscordUser } from "discord/user";
import { EolianUserService } from 'services/user';

export class DiscordTextChannel implements ContextTextChannel {

  constructor(private readonly channel: TextChannel | DMChannel | GroupDMChannel,
    private readonly users: EolianUserService) { }

  async send(message: string): Promise<ContextMessage> {
    const discordMessage = await this.channel.send(message);
    return new DiscordMessage(discordMessage as Message);
  }

  async sendSelection(question: string, options: string[], userId: string): Promise<number> {
    const embed = Embed.selection(question, options);
    await this.sendEmbed(embed);

    const selection = await this.awaitUserSelection(userId, options);
    if (!selection) {
      return null;
    }

    const idx = parseInt(selection.content);
    if (idx === 0) {
      await selection.reply('The selection has been cancelled.');
      return null;
    }

    return idx - 1;
  }

  private async awaitUserSelection(userId: string, options: string[]): Promise<Message | undefined> {
    const messages = await this.channel.awaitMessages((message: Message) => {
      if (message.author.id !== userId) {
        return false;
      }

      const idx = parseInt(message.content);
      return !isNaN(idx) && idx >= 0 && idx <= options.length
    }, { maxMatches: 1, time: 60000 });

    return messages.size ? messages.array()[0] : null;
  }

  async sendEmbed(embed: EmbedMessage): Promise<ContextMessage> {
    const rich: RichEmbed = new RichEmbed();

    embed.color && rich.setColor(embed.color);
    embed.header && rich.setAuthor(embed.header.text, embed.header.icon);
    embed.title && rich.setTitle(embed.title);
    embed.description && rich.setDescription(embed.description);
    embed.thumbnail && rich.setThumbnail(embed.thumbnail);
    embed.image && rich.setImage(embed.image);
    embed.url && rich.setURL(embed.url);
    embed.footer && rich.setFooter(embed.footer.text, embed.footer.icon);

    const message = await this.channel.send(rich) as Message;
    embed.buttons && await this.addButtons(message, embed.buttons);
    return new DiscordMessage(message);
  }

  private async addButtons(message: Message, buttons: MessageButton[]) {
    for (const button of buttons) {
      await message.react(button.emoji);
    }
    const collector = message.createReactionCollector((reaction: MessageReaction, user: User) => {
      if (!reaction.users.some(reactionUser => reactionUser === user)) {
        return false;
      }

      const button = buttons.find(button => button.emoji === reaction.emoji.name);
      if (!button || !button.onClick) {
        return false;
      }

      button.onClick(new DiscordMessage(reaction.message), new DiscordUser(user, this.users, PERMISSION.UNKNOWN))
        .catch(err => {
          logger.warn(`Button handler threw an unhandled exception: ${err.stack ? err.stack : err}`)
          return true;
        }).then(destroy => destroy && collector.stop());
    });
  }

}