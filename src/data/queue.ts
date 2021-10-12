import { Track } from 'api/@types';
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

  async remove(guildId: string, index: number, count: number): Promise<number> {
    return await this.cache.remove(guildId, index, count);
  }

  async move(guildId: string, to: number, from: number, count: number): Promise<void> {
    let list = await this.cache.get(guildId);
    if (list.length > 0) {
      const tracks = list.splice(from, count);
      list = list.slice(0, to).concat(tracks).concat(list.slice(to));
      await this.cache.set(guildId, list);
    }
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
    await this.clearPrev(guildId);
    return this.cache.del(guildId);
  }

  async clearPrev(guildId: string): Promise<void> {
    await this.cache.del(this.prevKey(guildId));
  }

  async pop(guildId: string, loop = false): Promise<Track | undefined> {
    const track = await this.cache.lpop(guildId);
    if (track.length) {
      if (loop) {
        await this.add(guildId, track);
      } else {
        await this.addPrev(guildId, track[0]);
      }
      return track[0];
    }
    return undefined;
  }

  async peek(guildId: string): Promise<Track | undefined> {
    return await this.cache.peek(guildId);
  }

  async unpop(guildId: string, count: number, loop = false): Promise<boolean> {
    count = Math.max(0, count);
    const key = loop ? guildId : this.prevKey(guildId);
    const size = await this.cache.size(key);
    if (size < count) {
      return false;
    }

    const prev = await this.cache.rpop(key, count);
    if (prev) {
      await this.cache.lpush(guildId, prev);
    }

    return true;
  }

  async peekReverse(guildId: string, idx = 0, loop = false): Promise<Track | undefined> {
    let key: string;
    if (loop) {
      key = guildId;
      idx = (await this.size(key)) - 1 - idx;
    } else {
      key = this.prevKey(guildId);
    }

    return this.cache.peek(key, idx);
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