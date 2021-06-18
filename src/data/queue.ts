import { Track } from 'api/@types';
import { AbsRangeArgument } from 'common/@types';
import { shuffleList } from 'common/util';
import { ListCache, MusicQueueCache } from './@types';
import { InMemoryListCache } from './cache';

const MAX_PREV = 10;

/**
 * Temporary implementation storing music queues in-memory.
 */
export class InMemoryQueues implements MusicQueueCache {

  private readonly cache: ListCache<Track>;

  constructor(ttl: number) {
    this.cache = new InMemoryListCache(ttl);
  }

  async size(guildId: string): Promise<number> {
    return this.cache.size(guildId);
  }

  async get(guildId: string, index: number, count: number): Promise<Track[]> {
    return await this.cache.range(guildId, index, count);
  }

  async remove(guildId: string, range: AbsRangeArgument): Promise<number> {
    return await this.cache.remove(guildId, range.start, range.stop - range.start);
  }

  async add(guildId: string, tracks: Track[], head = false): Promise<void> {
    if (head) {
      await this.cache.lpush(guildId, tracks);
    } else {
      await this.cache.rpush(guildId, tracks);
    }
  }

  async shuffle(guildId: string): Promise<boolean> {
    const list = await this.cache.get(guildId);
    if (list.length === 0) {
      return false;
    }

    await this.cache.set(guildId, shuffleList(list));

    return true;
  }

  async clear(guildId: string): Promise<boolean> {
    await this.cache.del(this.prevKey(guildId));
    return this.cache.del(guildId);
  }

  async pop(guildId: string): Promise<Track | undefined> {
    const track = await this.cache.lpop(guildId);
    if (track.length) {
      this.addPrev(guildId, track[0]);
      return track[0];
    }
    return undefined;
  }

  async peek(guildId: string): Promise<Track | undefined> {
    return await this.cache.peek(guildId);
  }

  async unpop(guildId: string, count: number): Promise<boolean> {
    count = Math.max(0, count);
    const size = await this.cache.size(this.prevKey(guildId));
    if (size < count) {
      return false;
    }

    const prev = await this.cache.rpop(this.prevKey(guildId), count);
    if (prev) {
      await this.cache.lpush(guildId, prev);
    }

    return true;
  }

  async peekReverse(guildId: string, idx = 0): Promise<Track | undefined> {
    return this.cache.peek(this.prevKey(guildId), idx);
  }

  private async addPrev(guildId: string, track: Track): Promise<void> {
    let tracks = await this.cache.get(this.prevKey(guildId));
    tracks.push(track);
    if (tracks.length === MAX_PREV) {
      tracks = tracks.slice(1);
    }
    await this.cache.set(this.prevKey(guildId), tracks);
  }

  private prevKey = (guildId: string) => `${guildId}_prev`;

}