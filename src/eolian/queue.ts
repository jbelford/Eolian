import { AbsRangeArgument } from 'common/@types';
import { ServerQueue } from 'data/@types';
import { EventEmitter } from 'events';
import { Track } from 'music/@types';
import { MusicQueueService } from 'services';

export class GuildQueue extends EventEmitter implements ServerQueue {

  constructor(
      private readonly queue: MusicQueueService,
      private readonly guildId: string) {
    super();
  }

  get(limit?: number | undefined): Promise<Track[]> {
    return this.queue.getTracks(this.guildId, limit);
  }

  async remove(range: AbsRangeArgument): Promise<number> {
    const removed = await this.queue.removeTracks(this.guildId, range);
    this.emitUpdate();
    return removed;
  }

  async add(tracks: Track[], head?: boolean | undefined): Promise<void> {
    await this.queue.addTracks(this.guildId, tracks, head);
    this.emitUpdate();
  }

  async shuffle(): Promise<boolean> {
    const shuffled = await this.queue.shuffleTracks(this.guildId);
    this.emitUpdate();
    return shuffled;
  }

  async clear(): Promise<boolean> {
    const cleared = await this.queue.clearTracks(this.guildId);
    this.emitUpdate();
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

  private emitUpdate = () => this.emit('update');

}