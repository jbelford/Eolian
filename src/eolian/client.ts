import { DISCORD_INVITE_PERMISSIONS } from 'common/constants';
import { Client } from 'discord.js';
import { ClientService } from './@types';

export class DiscordClient implements ClientService {

  constructor(private readonly client: Client) { }

  get name(): string {
    return this.client.user.username;
  }

  get pic(): string {
    return this.client.user.avatarURL;
  }

  generateInvite(): Promise<string> {
    return this.client.generateInvite(DISCORD_INVITE_PERMISSIONS);
  }

}
