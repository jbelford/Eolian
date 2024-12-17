import { Track } from '@eolian/api/@types';
import { Closable } from '@eolian/common/@types';
import { logger } from '@eolian/common/logger';
import { QueueCache, ServerDTO } from '@eolian/data/@types';
import {
  QueueDisplay,
  PlayerDisplay,
  ContextClient,
  ContextServer,
  ContextMusicQueue,
} from '../@types';
import { DiscordPlayerDisplay } from '../discord-player-display';
import { DiscordQueueDisplay } from '../discord-queue-display';
import { ServerMusicQueue } from '../server-music-queue';
import { DiscordPlayer } from '../voice';
import { Player } from '../voice/@types';
import { ServerStateDisplay, ServerState } from './@types';

class DiscordGuildStateDisplay implements ServerStateDisplay, Closable {
  private _queue?: QueueDisplay;
  private _player?: PlayerDisplay;

  constructor(private readonly state: ServerState) {}

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
    await Promise.allSettled([this._player?.close(), this._queue?.close()]);
    this._player = undefined;
    this._queue = undefined;
  }
}

export class DiscordGuildState implements ServerState {
  private _player?: Player;
  private _queue?: ContextMusicQueue;
  private disposable: Closable[] = [];

  readonly display: DiscordGuildStateDisplay = new DiscordGuildStateDisplay(this);

  constructor(
    private readonly guildId: string,
    private readonly client: ContextClient,
    readonly details: ContextServer,
    private readonly config: ServerDTO,
    private readonly queues: QueueCache<Track>,
  ) {}

  get player(): Player {
    if (!this._player) {
      this._player = new DiscordPlayer(this.client, this.queue, this.config.volume);
    }
    return this._player;
  }

  get queue(): ContextMusicQueue {
    if (!this._queue) {
      this._queue = new ServerMusicQueue(this.queues, this.guildId);
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
    logger.info('%s deleting guild state', this.guildId);
    await Promise.allSettled([
      this._player?.close(),
      this.display.close(),
      this.flushDisposables(),
    ]);
    this._player = undefined;
  }
}
