import { DEFAULT_VOLUME } from 'common/constants';
import { environment } from 'common/env';
import { ServerDTO, ServersDb } from 'data/@types';
import { Guild } from 'discord.js';
import { ServerDetails } from './@types';

export class DiscordGuild implements ServerDetails {

  private configCache: ServerDTO | null = null;

  constructor(private readonly servers: ServersDb, private readonly guild: Guild) {
  }

  get id(): string {
    return this.guild.id;
  }

  get name(): string {
    return this.guild.name;
  }

  get members(): number {
    return this.guild.memberCount;
  }

  get avatar(): string | undefined {
    return this.guild.iconURL({ dynamic: true }) ?? undefined;
  }

  async get(): Promise<ServerDTO> {
    if (!this.configCache) {
      this.configCache = await this.servers.get(this.id);
      if (!this.configCache) {
        this.configCache = { _id: this.id, prefix: environment.cmdToken, volume: DEFAULT_VOLUME };
      }
    }
    return this.configCache;
  }

  async setPrefix(prefix: string): Promise<void> {
    if (prefix.length !== 1) {
      throw new Error('Prefix must be length 1');
    }

    if (this.configCache) {
      this.configCache.prefix = prefix;
    }
    await this.servers.setPrefix(this.id, prefix);
  }

  async setVolume(volume: number): Promise<void> {
    if (volume < 0 || volume > 1) {
      throw new Error('Volume must be between 0 and 1');
    }

    if (this.configCache) {
      this.configCache.volume = volume;
    }
    await this.servers.setVolume(this.id, volume);
  }

}