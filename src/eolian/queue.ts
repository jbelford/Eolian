import { Track } from 'api/@types';
import { AbsRangeArgument } from 'common/@types';
import { IDLE_TIMEOUT } from 'common/constants';
import { MusicQueueCache, ServerQueue } from 'data/@types';
import { EventEmitter } from 'events';

export class GuildQueue extends EventEmitter implements ServerQueue {

  private lastUpdated = Date.now();

  constructor(
      private readonly queue: MusicQueueCache,
      private readonly guildId: string) {
    super();
  }

  get idle(): boolean {
    return Date.now() - this.lastUpdated >= IDLE_TIMEOUT * 1000;
  }

  async size(): Promise<number> {
    return this.queue.size(this.guildId);
  }

  async unpop(count: number): Promise<boolean> {
    return await this.queue.unpop(this.guildId, count);
  }

  async get(limit?: number | undefined): Promise<Track[]> {
    return await this.queue.get(this.guildId, limit);
  }

  async remove(range: AbsRangeArgument): Promise<number> {
    const removed = await this.queue.remove(this.guildId, range);
    this.emitRemove();
    return removed;
  }

  async add(tracks: Track[], head?: boolean | undefined): Promise<void> {
    await this.queue.add(this.guildId, tracks, head);
    this.emitAdd();
  }

  async shuffle(): Promise<boolean> {
    const shuffled = await this.queue.shuffle(this.guildId);
    this.emitUpdate();
    return shuffled;
  }

  async clear(): Promise<boolean> {
    const cleared = await this.queue.clear(this.guildId);
    this.emitRemove();
    return cleared;
  }

  async pop(): Promise<Track | undefined> {
    const popped = await this.queue.pop(this.guildId);
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