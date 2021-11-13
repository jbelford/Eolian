import { ServerDTO, ServersDb } from 'data/@types';
import { Client, Guild, PermissionResolvable } from 'discord.js';
import { DiscordPlayer } from 'music';
import { ContextClient, ContextVoiceConnection, ServerInfo } from './@types';
import { DiscordVoiceConnection } from './voice';

function mapGuildToServerInfo(guild: Guild): ServerInfo {
  const botCount = guild.members.cache.array().filter(m => m.user.bot).length;
  return {
    id: guild.id,
    name: guild.name,
    members: guild.memberCount,
    owner: guild.ownerID,
    botCount,
    botRatio: Math.round(100 * botCount / guild.memberCount) / 100
  };
}

export const DISCORD_INVITE_PERMISSIONS: PermissionResolvable = [
  'ADD_REACTIONS',
  'ATTACH_FILES',
  'CONNECT',
  'EMBED_LINKS',
  'MANAGE_MESSAGES',
  'MENTION_EVERYONE',
  'PRIORITY_SPEAKER',
  'READ_MESSAGE_HISTORY',
  'SEND_MESSAGES',
  'SPEAK',
  'USE_EXTERNAL_EMOJIS',
  'VIEW_CHANNEL',
];

export class DiscordClient implements ContextClient {

  constructor(protected readonly client: Client,
    private readonly servers: ServersDb) {
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
    return this.client.generateInvite({ permissions: DISCORD_INVITE_PERMISSIONS });
  }

  getServers(): ServerInfo[] {
    return this.client.guilds.cache.array().map(mapGuildToServerInfo);
  }

  getIdleServers(minDate: Date): Promise<ServerDTO[]> {
    return this.servers.getIdleServers(minDate);
  }

  async leave(id: string): Promise<boolean> {
    await this.servers.delete(id);
    return !!(await this.client.guilds.cache.get(id)?.leave());
  }

}

export class DiscordGuildClient extends DiscordClient {

  constructor(readonly client: Client,
      private readonly player: DiscordPlayer,
      servers: ServersDb) {
    super(client, servers);
  }

  getVoice(): ContextVoiceConnection | undefined {
    return this.player.connectionProvider.has() ? new DiscordVoiceConnection(this.player.connectionProvider.get()!, this.player) : undefined;
  }

}
