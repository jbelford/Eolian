import { shuffleList } from '@eolian/common/util';
import { ListCache, QueueCache } from '../@types';
import { InMemoryListCache } from './in-memory-list-cache';

const MAX_PREV = 10;

/**
 * Temporary implementation storing queues in-memory.
 */
export class InMemoryQueueCache<T> implements QueueCache<T> {
  private readonly cache: ListCache<T>;

  constructor(ttl: number) {
    this.cache = new InMemoryListCache(ttl);
  }

  async size(key: string, loop = false): Promise<number> {
    let size = await this.cache.size(key);
    if (loop) {
      size += await this.cache.size(this.prevKey(key));
    }
    return size;
  }

  async get(key: string, index: number, count: number): Promise<T[]> {
    return await this.cache.range(key, index, count);
  }

  async getLoop(key: string, count: number): Promise<T[]> {
    const prevKey = this.prevKey(key);
    const size = await this.cache.size(prevKey);
    return await this.cache.range(prevKey, Math.max(0, size - count), Math.min(count, size));
  }

  async remove(key: string, index: number, count: number): Promise<number> {
    return await this.cache.remove(key, index, count);
  }

  async move(key: string, to: number, from: number, count: number): Promise<void> {
    let list = await this.cache.get(key);
    if (list.length > 0) {
      const tracks = list.splice(from, count);
      list = list.slice(0, to).concat(tracks).concat(list.slice(to));
      await this.cache.set(key, list);
    }
  }

  async add(key: string, tracks: T[], head = false): Promise<void> {
    if (head) {
      await this.cache.lpush(key, tracks);
    } else {
      await this.cache.rpush(key, tracks);
    }
  }

  async shuffle(key: string): Promise<boolean> {
    const list = await this.cache.get(key);
    if (list.length === 0) {
      return false;
    }

    await this.cache.set(key, shuffleList(list));

    return true;
  }

  async clear(key: string): Promise<boolean> {
    await this.clearPrev(key);
    return this.cache.del(key);
  }

  async clearPrev(key: string): Promise<void> {
    await this.cache.del(this.prevKey(key));
  }

  async pop(key: string, loop = false): Promise<T | undefined> {
    let track = await this.cache.lpop(key);
    if (!track.length && loop) {
      track = await this.cache.lpop(this.prevKey(key));
    }
    if (track.length) {
      await this.addPrev(key, track[0], loop);
      return track[0];
    }
    return undefined;
  }

  async peek(key: string, loop = false): Promise<T | undefined> {
    let track = await this.cache.lpeek(key);
    if (loop && !track) {
      track = await this.cache.lpeek(this.prevKey(key));
    }
    return track;
  }

  async unpop(key: string, count: number): Promise<boolean> {
    count = Math.max(0, count);
    const prevKey = this.prevKey(key);
    const size = await this.cache.size(prevKey);
    if (size < count) {
      return false;
    }

    const prev = await this.cache.rpop(prevKey, count);
    if (prev) {
      await this.cache.lpush(key, prev);
    }

    return true;
  }

  async peekReverse(key: string, idx = 0): Promise<T | undefined> {
    return this.cache.rpeek(this.prevKey(key), idx);
  }

  private async addPrev(key: string, track: T, loop: boolean): Promise<void> {
    if (loop) {
      await this.cache.rpush(this.prevKey(key), [track]);
    } else {
      let tracks = await this.cache.get(this.prevKey(key));
      tracks.push(track);
      if (tracks.length >= MAX_PREV) {
        tracks = tracks.slice(tracks.length - MAX_PREV + 1);
      }
      await this.cache.set(this.prevKey(key), tracks);
    }
  }

  private prevKey = (guildId: string) => `${guildId}_prev`;
}
