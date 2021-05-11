import { AbsRangeArgument } from 'common/@types';
import { Track } from 'music/@types';
import { MusicQueueService } from 'services';
import { ContextQueue } from './@types';

export class GuildQueue implements ContextQueue {

  constructor(
    private readonly queue: MusicQueueService,
    private readonly guildId: string) {}

  get(limit?: number | undefined): Promise<Track[]> {
    return this.queue.getTracks(this.guildId, limit);
  }

  remove(range: AbsRangeArgument): Promise<number> {
    return this.queue.removeTracks(this.guildId, range);
  }

  add(tracks: Track[], head?: boolean | undefined): Promise<void> {
    return this.queue.addTracks(this.guildId, tracks, head);
  }

  shuffle(): Promise<boolean> {
    return this.queue.shuffleTracks(this.guildId);
  }

  clear(): Promise<boolean> {
    return this.queue.clearTracks(this.guildId);
  }

  pop(): Promise<Track | undefined> {
    return this.queue.pop(this.guildId);
  }

  peek(): Promise<Track | undefined> {
    return this.queue.peek(this.guildId);
  }

}