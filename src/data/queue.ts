import { Track } from 'api/@types';
import { AbsRangeArgument } from 'common/@types';
import { shuffleList } from 'common/util';
import { EolianCache, MusicQueueCache } from './@types';
import { InMemoryCache } from './cache';

const MAX_PREV = 10;

/**
 * Temporary implementation storing music queues in-memory.
 */
export class InMemoryQueues implements MusicQueueCache {

  private readonly cache: EolianCache<Track[]>;

  constructor(ttl: number) {
    this.cache = new InMemoryCache(ttl);
  }

  async unpop(guildId: string, count: number): Promise<boolean> {
    count = Math.max(0, count);
    const list = await this.getPrev(guildId);
    if (list.length < count) {
      return false;
    }

    const tracks = list.splice(Math.max(0, list.length - count), count);
    await this.setPrev(guildId, list);
    await this.add(guildId, tracks, true);

    return true;
  }

  async get(guildId: string, limit?: number): Promise<Track[]> {
    const list = await this.cache.get(guildId) || [];
    return limit ? list.slice(0, limit) : list;
  }

  async remove(guildId: string, range: AbsRangeArgument): Promise<number> {
    const list = await this.cache.get(guildId) || [];
    const newList = list.slice(0, range.start).concat(list.slice(range.stop));
    await this.cache.set(guildId, newList);
    return range.stop - range.start;
  }

  async add(guildId: string, tracks: Track[], head = false): Promise<void> {
    const list = await this.cache.get(guildId) || [];
    const newList = head ? tracks.concat(list) : list.concat(tracks);
    await this.cache.set(guildId, newList);
  }

  async shuffle(guildId: string): Promise<boolean> {
    const list = await this.cache.get(guildId);
    if (!list) return false;

    await this.cache.set(guildId, shuffleList(list));

    return true;
  }

  async clear(guildId: string): Promise<boolean> {
    await this.cache.del(`${guildId}_prev`);
    return this.cache.del(guildId);
  }

  async pop(guildId: string): Promise<Track | undefined> {
    const list = await this.cache.get(guildId) || [];
    if (!list.length) {
      return;
    }

    const track = list.shift()!;
    this.addPrev(guildId, track);
    await this.cache.set(guildId, list);
    return track;
  }

  async peek(guildId: string): Promise<Track | undefined> {
    const list = await this.cache.get(guildId) || [];
    return list.length ? list[0] : undefined;
  }

  async peekReverse(guildId: string, idx = 0): Promise<Track | undefined> {
    const list = await this.cache.get(`${guildId}_prev`) || [];
    return list.length ? list[idx] : undefined;
  }

  private async getPrev(guildId: string): Promise<Track[]> {
    return await this.cache.get(`${guildId}_prev`) || [];
  }

  private async setPrev(guildId: string, tracks: Track[]): Promise<void> {
    await this.cache.set(`${guildId}_prev`, tracks);
  }

  private async addPrev(guildId: string, track: Track): Promise<void> {
    let tracks = await this.getPrev(guildId);
    tracks.push(track);
    if (tracks.length === MAX_PREV) {
      tracks = tracks.slice(1);
    }
    await this.setPrev(guildId, tracks);
  }

}