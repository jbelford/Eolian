import { DMChannel, GroupDMChannel, Message, MessageReaction, RichEmbed, TextChannel, User } from "discord.js";
import { PERMISSION } from "../common/constants";
import { logger } from "../common/logger";
import { DiscordMessage } from "./message";
import { DiscordUser } from "./user";

export class DiscordTextChannel implements ContextTextChannel {

  constructor(private readonly channel: TextChannel | DMChannel | GroupDMChannel) { }

  async send(message: string): Promise<void> {
    await this.channel.send(message);
  }

  async sendEmbed(embed: EmbedMessage): Promise<void> {
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
  }

  private async addButtons(message: Message, buttons: MessageButton[]) {
    for (const button of buttons) {
      await message.react(button.emoji);
    }
    const collector = message.createReactionCollector((reaction: MessageReaction, user: User) => {
      if (!reaction.users.some(reactionUser => reactionUser === user)) return false;
      const button = buttons.find(button => button.emoji === reaction.emoji.name);
      if (!button || !button.onClick) return false;
      button.onClick(new DiscordMessage(reaction.message), new DiscordUser(user, PERMISSION.UNKNOWN))
        .catch(err => {
          logger.warn(`Button handler threw an unhandled exception: ${err.stack ? err.stack : err}`)
          return true;
        }).then(destroy => {
          if (destroy) collector.stop();
        });
    });
  }

}