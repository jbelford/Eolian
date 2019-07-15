import { Client } from "discord.js";
import { INVITE_PERMISSIONS } from "discord/constants";

export class DiscordBotService implements BotService {

  constructor(private readonly client: Client) { }

  get name() {
    return this.client.user.username;
  }

  get pic() {
    return this.client.user.avatarURL;
  }

  public async generateInvite() {
    return await this.client.generateInvite(INVITE_PERMISSIONS);
  }

}