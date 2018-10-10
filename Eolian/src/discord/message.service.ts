import { Message, RichEmbed } from "discord.js";

export class DiscordMessageService implements MessageService {

  constructor(private readonly message: Message) { }

  async reply(message: string): Promise<void> {
    await this.message.reply(message);
  };

  async send(message: string): Promise<void> {
    await this.message.channel.send(message);
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
    await this.message.channel.send(rich);
  }

}