import { Message } from "discord.js";

export class DiscordMessageStrategy implements MessageStrategy {

  constructor(private readonly message: Message) { }

  reply(message: string): Promise<void> {
    throw new Error("Method not implemented.");
  };

  send(message: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  sendEmbed(embed: EmbedMessage): Promise<void> {
    throw new Error("Method not implemented.");
  }

}