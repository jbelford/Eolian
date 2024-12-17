import { getVoiceConnection } from '@discordjs/voice';
import { ServersDb, ServerDTO } from '@eolian/data/@types';
import { Guild, OAuth2Scopes, PermissionResolvable, PermissionFlagsBits, Client } from 'discord.js';
import { ContextServerInfo, ContextClient, ContextVoiceConnection } from './@types';
import { registerGlobalSlashCommands } from './discord-slash-commands';
import { DiscordGuildStore } from './state/discord-guild-store';
import { DiscordVoiceConnection } from './voice';

function mapGuildToServerInfo(guild: Guild): ContextServerInfo {
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

export const INVITE_SCOPES: OAuth2Scopes[] = [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands];

export const DISCORD_INVITE_PERMISSIONS: PermissionResolvable = [
  PermissionFlagsBits.AddReactions,
  PermissionFlagsBits.AttachFiles,
  PermissionFlagsBits.Connect,
  PermissionFlagsBits.EmbedLinks,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.MentionEveryone,
  PermissionFlagsBits.PrioritySpeaker,
  PermissionFlagsBits.ReadMessageHistory,
  PermissionFlagsBits.SendMessages,
  PermissionFlagsBits.Speak,
  PermissionFlagsBits.UseExternalEmojis,
  PermissionFlagsBits.ViewChannel,
];

export class DiscordClient implements ContextClient {
  constructor(
    protected readonly client: Client,
    private readonly guildStore: DiscordGuildStore,
    private readonly servers: ServersDb,
  ) {}

  get name(): string {
    return this.client.user!.username;
  }

  get pic(): string | undefined {
    return this.client.user!.avatarURL() || undefined;
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

  getServers(): ContextServerInfo[] {
    return this.client.guilds.cache.map(mapGuildToServerInfo);
  }

  getIdleServers(minDate: Date): Promise<ServerDTO[]> {
    return this.servers.getIdleServers(minDate);
  }

  async getUnusedServers(): Promise<ContextServerInfo[]> {
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
    servers: ServersDb,
  ) {
    super(client, guildStore, servers);
  }

  getVoice(): ContextVoiceConnection | undefined {
    const connection = getVoiceConnection(this.guildId);
    return connection && new DiscordVoiceConnection(this.client, connection);
  }
}
