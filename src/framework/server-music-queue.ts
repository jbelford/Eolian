import { Track } from '@eolian/api/@types';
import { IDLE_TIMEOUT_MINS } from '@eolian/common/constants';
import { QueueCache } from '@eolian/data/@types';
import { EventEmitter } from 'node-cache';
import { ContextMusicQueue } from './@types';

export class ServerMusicQueue extends EventEmitter implements ContextMusicQueue {
  private lastUpdated = Date.now();
  private loopEnabled = false;

  constructor(
    private readonly queue: QueueCache<Track>,
    private readonly serverId: string,
  ) {
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
    return this.queue.size(this.serverId, loop && this.loop);
  }

  async unpop(count: number): Promise<boolean> {
    return await this.queue.unpop(this.serverId, count);
  }

  async get(index: number, count: number): Promise<[Track[], Track[]]> {
    const tracks = await this.queue.get(this.serverId, index, count);
    if (this.loop && tracks.length < count) {
      const loopTracks = await this.queue.getLoop(this.serverId, count - tracks.length);
      return [tracks, loopTracks];
    }
    return [tracks, []];
  }

  async remove(index: number, count: number): Promise<number> {
    const removed = await this.queue.remove(this.serverId, index, count);
    this.emitRemove();
    return removed;
  }

  async move(to: number, from: number, count: number): Promise<void> {
    await this.queue.move(this.serverId, to, from, count);
    this.emitUpdate();
  }

  async add(tracks: Track[], head?: boolean | undefined): Promise<void> {
    await this.queue.add(this.serverId, tracks, head);
    this.emitAdd();
  }

  async shuffle(): Promise<boolean> {
    const shuffled = await this.queue.shuffle(this.serverId);
    this.emitUpdate();
    return shuffled;
  }

  async clear(): Promise<boolean> {
    const cleared = await this.queue.clear(this.serverId);
    this.emitRemove();
    return cleared;
  }

  async pop(): Promise<Track | undefined> {
    const popped = await this.queue.pop(this.serverId, this.loop);
    this.emitUpdate();
    return popped;
  }

  peek(): Promise<Track | undefined> {
    return this.queue.peek(this.serverId, this.loop);
  }

  peekReverse(idx: number): Promise<Track | undefined> {
    return this.queue.peekReverse(this.serverId, idx);
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
