import { getVoiceConnection } from '@discordjs/voice';
import { ServerDTO, ServersDb } from 'data/@types';
import { Client, Guild, InviteScope, PermissionResolvable } from 'discord.js';
import { ContextClient, ContextVoiceConnection, ServerInfo } from './@types';
import { registerGlobalSlashCommands } from './register_commands';
import { DiscordGuildStore } from './state';
import { DiscordVoiceConnection } from './voice';

function mapGuildToServerInfo(guild: Guild): ServerInfo {
  const botCount = guild.members.cache.filter(m => m.user.bot).size;
  return {
    id: guild.id,
    name: guild.name,
    members: guild.memberCount,
    owner: guild.ownerId,
    botCount,
    botRatio: Math.round((100 * botCount) / guild.memberCount) / 100,
  };
}

export const INVITE_SCOPES: InviteScope[] = ['bot', 'applications.commands'];

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

  constructor(
    protected readonly client: Client,
    private readonly guildStore: DiscordGuildStore,
    private readonly servers: ServersDb
  ) {}

  get name(): string {
    return this.client.user!.username;
  }

  get pic(): string | undefined {
    return this.client.user!.avatarURL({ dynamic: true }) || undefined;
  }

  getVoice(): ContextVoiceConnection | undefined {
    return undefined;
  }

  generateInvite(): string {
    return this.client.generateInvite({
      scopes: INVITE_SCOPES,
      permissions: DISCORD_INVITE_PERMISSIONS,
    });
  }

  getServers(): ServerInfo[] {
    return this.client.guilds.cache.map(mapGuildToServerInfo);
  }

  getIdleServers(minDate: Date): Promise<ServerDTO[]> {
    return this.servers.getIdleServers(minDate);
  }

  async getUnusedServers(): Promise<ServerInfo[]> {
    const guilds = this.client.guilds.cache.map(g => g);
    const servers = await Promise.all(guilds.map(server => this.servers.get(server.id)));
    return servers
      .map((s, i) => (s ? undefined : guilds[i]))
      .filter(s => !!s)
      .map(g => mapGuildToServerInfo(g!));
  }

  updateCommands(): Promise<boolean> {
    return registerGlobalSlashCommands();
  }

  getRecentlyUsedCount(): number {
    return this.guildStore.active;
  }

  async leave(id: string): Promise<boolean> {
    await this.servers.delete(id);
    return !!(await this.client.guilds.cache.get(id)?.leave());
  }

}

export class DiscordGuildClient extends DiscordClient {

  constructor(
    readonly client: Client,
    private readonly guildId: string,
    guildStore: DiscordGuildStore,
    servers: ServersDb
  ) {
    super(client, guildStore, servers);
  }

  getVoice(): ContextVoiceConnection | undefined {
    const connection = getVoiceConnection(this.guildId);
    return connection && new DiscordVoiceConnection(this.client, connection);
  }

}
