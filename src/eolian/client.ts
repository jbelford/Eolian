import { DISCORD_INVITE_PERMISSIONS } from 'common/constants';
import { Client } from 'discord.js';
import { ContextClient } from './@types';

export class DiscordClient implements ContextClient {

  constructor(private readonly client: Client) { }

  get name(): string {
    return this.client.user!.username;
  }

  get pic(): string | undefined {
    return this.client.user!.avatarURL({ dynamic: true }) || undefined;
  }

  generateInvite(): Promise<string> {
    return this.client.generateInvite(DISCORD_INVITE_PERMISSIONS);
  }

}
