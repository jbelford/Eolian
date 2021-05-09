import { DISCORD_INVITE_PERMISSIONS } from 'common/constants';
import { PlayerStore } from 'data/@types';
import { Client } from 'discord.js';
import { ContextClient, ContextQueue, ContextVoiceConnection } from './@types';
import { DiscordVoiceConnection } from './voice';

export class DiscordClient implements ContextClient {

  constructor(private readonly client: Client,
    private readonly guildId: string,
    private readonly queue: ContextQueue,
    private readonly players: PlayerStore) { }

  get name(): string {
    return this.client.user!.username;
  }

  get pic(): string | undefined {
    return this.client.user!.avatarURL({ dynamic: true }) || undefined;
  }

  get voice(): ContextVoiceConnection | undefined {
    const connection = this.client.voice!.connections.get(this.guildId);
    return connection ? new DiscordVoiceConnection(connection, this.queue, this.players) : undefined;
  }

  generateInvite(): Promise<string> {
    return this.client.generateInvite(DISCORD_INVITE_PERMISSIONS);
  }

}
