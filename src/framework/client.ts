import { DISCORD_INVITE_PERMISSIONS } from 'common/constants';
import { Client } from 'discord.js';
import { DiscordPlayer } from 'music';
import { ContextClient, ContextVoiceConnection, ServerInfo } from './@types';
import { DiscordVoiceConnection } from './voice';

export class DiscordClient implements ContextClient {

  constructor(protected readonly client: Client) {
  }

  get name(): string {
    return this.client.user!.username;
  }

  get pic(): string | undefined {
    return this.client.user!.avatarURL({ dynamic: true }) || undefined;
  }

  getVoice(): ContextVoiceConnection | undefined {
    return undefined;
  }

  generateInvite(): Promise<string> {
    return this.client.generateInvite(DISCORD_INVITE_PERMISSIONS);
  }

  getServers(): ServerInfo[] {
    return this.client.guilds.cache.array().map(guild => ({ name: guild.name, members: guild.memberCount, id: guild.id, owner: guild.ownerID }));
  }

}

export class DiscordGuildClient extends DiscordClient {

  constructor(readonly client: Client,
      private readonly player: DiscordPlayer) {
    super(client);
  }

  getVoice(): ContextVoiceConnection | undefined {
    return this.player.connectionProvider.has() ? new DiscordVoiceConnection(this.player.connectionProvider.get()!, this.player) : undefined;
  }

}
