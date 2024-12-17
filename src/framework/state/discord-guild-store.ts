import { Track } from '@eolian/api/@types';
import { Closable } from '@eolian/common/@types';
import { environment } from '@eolian/common/env';
import { logger } from '@eolian/common/logger';
import { InMemoryCache, InMemoryQueueCache } from '@eolian/data';
import { EolianCache, QueueCache, ServersDb } from '@eolian/data/@types';
import { Client, Guild } from 'discord.js';
import { ContextServer } from '../@types';
import { DiscordGuildClient } from '../discord-client';
import { DiscordGuild } from '../discord-guild';
import { ServerStateStore, ServerState } from './@types';
import { DiscordGuildState } from './discord-guild-state';

class InMemoryServerStateStore implements ServerStateStore {
  private cache: EolianCache<ServerState>;
  private _active = 0;

  constructor(private readonly ttl: number) {
    this.cache = new InMemoryCache(this.ttl, false, this.onExpired, this.onClose);
  }

  get active(): number {
    return this._active;
  }

  async get(guildId: string): Promise<ServerState | undefined> {
    const state = await this.cache.get(guildId);
    if (state) {
      await this.cache.refreshTTL(guildId);
    }
    return state;
  }

  async set(guildId: string, context: ServerState): Promise<void> {
    logger.info('%s storing guild state', guildId);
    await this.cache.set(guildId, context, this.ttl);
    this._active++;
  }

  async close(): Promise<void> {
    await this.cache.close();
  }

  private onClose = (state: ServerState) => {
    return state.close();
  };

  private onExpired = async (key: string, state: ServerState) => {
    try {
      logger.info('%s guild state expired', key);
      if (state.isIdle()) {
        await state.close();
        this._active--;
      } else {
        await state.closeIdle();
        await this.cache.set(key, state);
      }
    } catch (e) {
      logger.warn(`Error occured clearing guild state: %s`, e);
    }
  };
}

const QUEUE_CACHE_TIMEOUT = 60 * 60 * 3;

export class DiscordGuildStore implements Closable {
  private readonly guildMap = new Map<string, ContextServer>();
  private readonly queues: QueueCache<Track> = new InMemoryQueueCache(QUEUE_CACHE_TIMEOUT);
  private readonly stateStore: ServerStateStore = new InMemoryServerStateStore(
    environment.config.guildCacheTTL,
  );

  constructor(
    private readonly client: Client,
    private readonly serversDb: ServersDb,
  ) {}

  get active(): number {
    return this.stateStore.active;
  }

  getDetails(guild: Guild): ContextServer {
    let details = this.guildMap.get(guild.id);
    if (!details) {
      details = new DiscordGuild(this.serversDb, guild);
      this.guildMap.set(guild.id, details);
    }
    return details;
  }

  async getState(guild: Guild): Promise<ServerState> {
    let state = await this.stateStore.get(guild.id);
    if (!state) {
      const details = this.getDetails(guild);
      const dto = await details.get();

      const guildClient = new DiscordGuildClient(this.client, guild.id, this, this.serversDb);
      state = new DiscordGuildState(guild.id, guildClient, details, dto, this.queues);
      await this.stateStore.set(guild.id, state);
    }
    return state;
  }

  async close(): Promise<void> {
    await this.stateStore.close();
  }
}
