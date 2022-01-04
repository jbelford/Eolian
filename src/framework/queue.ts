import { Track } from 'api/@types';
import { IDLE_TIMEOUT_MINS } from 'common/constants';
import { MusicQueueCache, ServerQueue } from 'data/@types';
import { EventEmitter } from 'events';

export class GuildQueue extends EventEmitter implements ServerQueue {

  private lastUpdated = Date.now();
  private loopEnabled = false;

  constructor(private readonly queue: MusicQueueCache, private readonly guildId: string) {
    super();
  }

  get idle(): boolean {
    return Date.now() - this.lastUpdated >= IDLE_TIMEOUT_MINS * 1000;
  }

  get loop(): boolean {
    return this.loopEnabled;
  }

  async setLoopMode(enabled: boolean): Promise<void> {
    if (this.loopEnabled !== enabled) {
      this.loopEnabled = enabled;
      this.emitUpdate();
    }
  }

  async size(loop = false): Promise<number> {
    return this.queue.size(this.guildId, loop && this.loop);
  }

  async unpop(count: number): Promise<boolean> {
    return await this.queue.unpop(this.guildId, count);
  }

  async get(index: number, count: number): Promise<[Track[], Track[]]> {
    const tracks = await this.queue.get(this.guildId, index, count);
    if (this.loop && tracks.length < count) {
      const loopTracks = await this.queue.getLoop(this.guildId, count - tracks.length);
      return [tracks, loopTracks];
    }
    return [tracks, []];
  }

  async remove(index: number, count: number): Promise<number> {
    const removed = await this.queue.remove(this.guildId, index, count);
    this.emitRemove();
    return removed;
  }

  async move(to: number, from: number, count: number): Promise<void> {
    await this.queue.move(this.guildId, to, from, count);
    this.emitUpdate();
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
    const popped = await this.queue.pop(this.guildId, this.loop);
    this.emitUpdate();
    return popped;
  }

  peek(): Promise<Track | undefined> {
    return this.queue.peek(this.guildId, this.loop);
  }

  peekReverse(idx: number): Promise<Track | undefined> {
    return this.queue.peekReverse(this.guildId, idx);
  }

  private emitUpdate = () => {
    this.lastUpdated = Date.now();
    this.emit('update');
  };

  private emitAdd = () => {
    this.emit('add');
    this.emitUpdate();
  };

  private emitRemove = () => {
    this.emit('remove');
    this.emitUpdate();
  };

}
