import { Closable } from 'common/@types';
import { logger } from 'common/logger';
import { InMemoryCache, InMemoryQueues } from 'data';
import { EolianCache, MusicQueueCache, ServerDTO, ServerQueue, ServersDb } from 'data/@types';
import { Client, Guild } from 'discord.js';
import { DiscordPlayer } from 'music';
import { Player } from 'music/@types';
import { ContextClient, PlayerDisplay, QueueDisplay, ServerDetails, ServerState, ServerStateDisplay, ServerStateStore } from './@types';
import { DiscordGuildClient } from './client';
import { DiscordPlayerDisplay, DiscordQueueDisplay } from './display';
import { GuildQueue } from './queue';
import { DiscordGuild } from './server';


export class InMemoryServerStateStore implements ServerStateStore {

  private cache: EolianCache<ServerState>;
  private _active = 0;

  constructor(private readonly ttl: number) {
    this.cache = new InMemoryCache(this.ttl, false, this.onExpired);
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

class DiscordGuildStateDisplay implements ServerStateDisplay, Closable {

  private _queue?: QueueDisplay;
  private _player?: PlayerDisplay;

  constructor(private readonly state: ServerState) {
  }

  get queue(): QueueDisplay {
    if (!this._queue) {
      this._queue = new DiscordQueueDisplay(this.state.queue);
    }
    return this._queue;
  }

  get player(): PlayerDisplay {
    if (!this._player) {
      this._player = new DiscordPlayerDisplay(this.state.player, this.queue);
    }
    return this._player;
  }

  async close(): Promise<void> {
    await Promise.allSettled([
      this._player?.close(),
      this._queue?.close()
    ]);
    this._player = undefined;
    this._queue = undefined;
  }

}

class DiscordGuildState implements ServerState {

  private _player?: Player;
  private _queue?: ServerQueue;
  private disposable: Closable[] = [];

  readonly display: DiscordGuildStateDisplay = new DiscordGuildStateDisplay(this);

  constructor(
    private readonly guildId: string,
    private readonly client: ContextClient,
    readonly details: ServerDetails,
    private readonly config: ServerDTO,
    private readonly queues: MusicQueueCache) {
  }

  get player(): Player {
    if (!this._player) {
      this._player = new DiscordPlayer(this.client, this.queue, this.config.volume);
    }
    return this._player;
  }

  get queue(): ServerQueue {
    if (!this._queue) {
      this._queue = new GuildQueue(this.queues, this.guildId);
    }
    return this._queue;
  }

  isIdle(): boolean {
    return this.player.idle && this.queue.idle;
  }

  async closeIdle(): Promise<void> {
    logger.info('%s stopping partially idle guild state', this.guildId);
    if (this.player.idle) {
      await this.display.player.removeIdle();
      this.player.stop();
    } else if (this.queue.idle) {
      await this.display.queue.removeIdle();
    }
    await this.flushDisposables();
  }

  addDisposable(disposable: Closable): void {
    this.disposable.push(disposable);
  }

  async flushDisposables(): Promise<void> {
    await Promise.allSettled(this.disposable.map(d => d.close()));
    this.disposable = [];
  }

  async close(): Promise<void> {
    logger.info('%s deleting idle guild state', this.guildId);
    await Promise.allSettled([
      this._player?.close(),
      this.display.close(),
      this.flushDisposables(),
    ]);
    this._player = undefined;
  }

}

const QUEUE_CACHE_TIMEOUT = 60 * 60 * 3;
const SERVER_STATE_CACHE_TIMEOUT = 60 * 15;

export class DiscordGuildStore {

  private readonly guildMap = new Map<string, ServerDetails>();
  private readonly queues: MusicQueueCache = new InMemoryQueues(QUEUE_CACHE_TIMEOUT);
  private readonly stateStore: ServerStateStore = new InMemoryServerStateStore(SERVER_STATE_CACHE_TIMEOUT);

  constructor(
    private readonly client: Client,
    private readonly serversDb: ServersDb) {
  }

  get active(): number {
    return this.stateStore.active;
  }

  getDetails(guild: Guild): ServerDetails {
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

}