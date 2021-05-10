import { DISCORD_INVITE_PERMISSIONS } from 'common/constants';
import { PlayerStore } from 'data/@types';
import { Client } from 'discord.js';
import { Player } from 'music/@types';
import { ContextClient, ContextQueue, ContextVoiceConnection } from './@types';
import { DiscordPlayer, DiscordVoiceConnection, VoiceConnectionProvider } from './voice';

export class DiscordClient implements ContextClient {

  private readonly player: Player;
  private readonly connectionProvider: VoiceConnectionProvider;

  constructor(private readonly client: Client,
      private readonly guildId: string,
      private readonly queue: ContextQueue,
      private readonly players: PlayerStore) {
    this.connectionProvider = new VoiceConnectionProvider(this.client, this.guildId);
    let player = this.players.get(this.guildId);
    if (!player) {
      player = new DiscordPlayer(this.connectionProvider, this.queue);
      players.store(this.guildId, player);
    }
    this.player = player;
  }

  get name(): string {
    return this.client.user!.username;
  }

  get pic(): string | undefined {
    return this.client.user!.avatarURL({ dynamic: true }) || undefined;
  }

  getVoice(): ContextVoiceConnection | undefined {
    return this.connectionProvider.has() ? new DiscordVoiceConnection(this.connectionProvider.get()!, this.player) : undefined;
  }

  generateInvite(): Promise<string> {
    return this.client.generateInvite(DISCORD_INVITE_PERMISSIONS);
  }

}