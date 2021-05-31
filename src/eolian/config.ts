import { environment } from 'common/env';
import { ServerDTO, ServersDb } from 'data/@types';
import { ServerConfig } from './@types';

export class DiscordGuildConfig implements ServerConfig {

  private configCache: ServerDTO | null = null;


  constructor(private readonly servers: ServersDb, private readonly guildId: string) {
  }

  async get(): Promise<ServerDTO> {
    if (!this.configCache) {
      this.configCache = await this.servers.get(this.guildId);
      if (!this.configCache) {
        this.configCache = { _id: this.guildId, prefix: environment.cmdToken };
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
    await this.servers.setPrefix(this.guildId, prefix);
  }

}