import { Track } from 'api/@types';
import { AbsRangeArgument } from 'common/@types';
import { IDLE_TIMEOUT } from 'common/constants';
import { MusicQueueCache, ServerQueue } from 'data/@types';
import { EventEmitter } from 'events';

export class GuildQueue extends EventEmitter implements ServerQueue {

  private lastUpdated = Date.now();
  private _count: number | undefined;

  constructor(
      private readonly queue: MusicQueueCache,
      private readonly guildId: string) {
    super();
  }

  get idle(): boolean {
    return Date.now() - this.lastUpdated >= IDLE_TIMEOUT * 1000;
  }

  async size(): Promise<number> {
    if (this._count === undefined) {
      const tracks = await this.queue.get(this.guildId);
      this._count = tracks.length;
    }
    return this._count;
  }

  async unpop(count: number): Promise<boolean> {
    const succeed = await this.queue.unpop(this.guildId, count);
    if (succeed && this._count !== undefined) {
      this._count += Math.max(0, count);
    }
    return succeed;
  }

  async get(limit?: number | undefined): Promise<Track[]> {
    const tracks = await this.queue.get(this.guildId, limit);
    if (!limit) {
      this._count = tracks.length;
    }
    return tracks;
  }

  async remove(range: AbsRangeArgument): Promise<number> {
    const removed = await this.queue.remove(this.guildId, range);
    if (this._count !== undefined) {
      this._count -= removed;
    }
    this.emitRemove();
    return removed;
  }

  async add(tracks: Track[], head?: boolean | undefined): Promise<void> {
    await this.queue.add(this.guildId, tracks, head);
    if (this._count !== undefined) {
      this._count += tracks.length;
    }
    this.emitAdd();
  }

  async shuffle(): Promise<boolean> {
    const shuffled = await this.queue.shuffle(this.guildId);
    this.emitUpdate();
    return shuffled;
  }

  async clear(): Promise<boolean> {
    const cleared = await this.queue.clear(this.guildId);
    this._count = 0;
    this.emitRemove();
    return cleared;
  }

  async pop(): Promise<Track | undefined> {
    const popped = await this.queue.pop(this.guildId);
    if (popped && this._count !== undefined) {
      this._count--;
    }
    this.emitUpdate();
    return popped;
  }

  peek(): Promise<Track | undefined> {
    return this.queue.peek(this.guildId);
  }

  peekReverse(idx: number): Promise<Track | undefined> {
    return this.queue.peekReverse(this.guildId, idx);
  }

  private emitUpdate = () => {
    this.lastUpdated = Date.now();
    this.emit('update')
  };

  private emitAdd = () => {
    this.emit('add');
    this.emitUpdate();
  }

  private emitRemove = () => {
    this.emit('remove');
    this.emitUpdate();
  }

}