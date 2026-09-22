import { SyntaxType } from '@eolian/command-options/@types';
import { DEFAULT_VOLUME } from '@eolian/common/constants';
import { environment } from '@eolian/common/env';
import { ServerSettingsUpdate } from '@eolian/data/@types';
import { ChannelType, Client, Guild } from 'discord.js';
import { DiscordGuildStore } from './state/discord-guild-store';

export interface ManagedGuildSummary {
  id: string;
  name: string;
  icon: string | null;
}

export interface ManagedGuildOption {
  id: string;
  name: string;
}

export interface ManagedGuildSettings {
  prefix: string;
  volume: number;
  syntax: SyntaxType;
  preferredChannelId: string | null;
  djRoleIds: string[];
  djAllowLimited: boolean;
}

export interface ManagedGuild extends ManagedGuildSummary {
  memberCount: number;
  settings: ManagedGuildSettings;
  channels: ManagedGuildOption[];
  roles: ManagedGuildOption[];
}

export interface DiscordManagement {
  listGuilds(): ManagedGuildSummary[];
  getGuild(id: string): Promise<ManagedGuild>;
  updateGuild(id: string, settings: ServerSettingsUpdate): Promise<ManagedGuild>;
}

export class DiscordManagementError extends Error {
  constructor(
    readonly code: 'bot_not_ready' | 'bot_not_in_guild' | 'channel_not_found' | 'role_not_found',
  ) {
    super(code);
  }
}

export class DiscordBotManagement implements DiscordManagement {
  constructor(
    private readonly client: Client,
    private readonly guildStore: DiscordGuildStore,
  ) {}

  listGuilds(): ManagedGuildSummary[] {
    this.requireReady();
    return this.client.guilds.cache
      .map(guild => this.summary(guild))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  async getGuild(id: string): Promise<ManagedGuild> {
    const guild = this.requireGuild(id);
    const config = await this.guildStore.getDetails(guild).get();
    return {
      ...this.summary(guild),
      memberCount: guild.memberCount,
      settings: {
        prefix: config.prefix ?? environment.cmdToken,
        volume: config.volume ?? DEFAULT_VOLUME,
        syntax: config.syntax ?? SyntaxType.KEYWORD,
        preferredChannelId: config.preferredChannelId ?? null,
        djRoleIds: [...(config.djRoleIds ?? [])],
        djAllowLimited: config.djAllowLimited ?? false,
      },
      channels: guild.channels.cache
        .filter(
          channel =>
            channel.type === ChannelType.GuildText ||
            channel.type === ChannelType.GuildAnnouncement,
        )
        .map(channel => ({ id: channel.id, name: channel.name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
      roles: guild.roles.cache
        .filter(role => role.id !== guild.id)
        .map(role => ({ id: role.id, name: role.name }))
        .sort((left, right) => left.name.localeCompare(right.name)),
    };
  }

  async updateGuild(id: string, settings: ServerSettingsUpdate): Promise<ManagedGuild> {
    const guild = this.requireGuild(id);
    if (
      settings.preferredChannelId !== undefined &&
      settings.preferredChannelId !== null &&
      !this.isConfigurableChannel(guild, settings.preferredChannelId)
    ) {
      throw new DiscordManagementError('channel_not_found');
    }
    if (settings.djRoleIds?.some(roleId => !guild.roles.cache.has(roleId) || roleId === guild.id)) {
      throw new DiscordManagementError('role_not_found');
    }

    await this.guildStore.getDetails(guild).updateSettings(settings);
    if (settings.volume !== undefined) {
      const state = await this.guildStore.getCachedState(id);
      if (state && !state.player.isStreaming) {
        state.player.setVolume(settings.volume);
      }
    }
    return this.getGuild(id);
  }

  private requireReady(): void {
    if (!this.client.isReady()) {
      throw new DiscordManagementError('bot_not_ready');
    }
  }

  private requireGuild(id: string): Guild {
    this.requireReady();
    const guild = this.client.guilds.cache.get(id);
    if (!guild) {
      throw new DiscordManagementError('bot_not_in_guild');
    }
    return guild;
  }

  private summary(guild: Guild): ManagedGuildSummary {
    return {
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL(),
    };
  }

  private isConfigurableChannel(guild: Guild, id: string): boolean {
    const channel = guild.channels.cache.get(id);
    return (
      channel?.type === ChannelType.GuildText || channel?.type === ChannelType.GuildAnnouncement
    );
  }
}
