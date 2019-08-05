import { Client } from "discord.js";
import { INVITE_PERMISSIONS } from "discord/constants";

export class DiscordBotService implements BotService {

  constructor(private readonly client: Client) { }

  get name(): string {
    return this.client.user.username;
  }

  get pic(): string {
    return this.client.user.avatarURL;
  }

  generateInvite(): Promise<string> {
    return this.client.generateInvite(INVITE_PERMISSIONS);
  }

}