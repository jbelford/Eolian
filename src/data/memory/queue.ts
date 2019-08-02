import { Util } from 'common/util';
import { InMemoryCache } from './cache';

/**
 * Temporary implementation storing music queues in-memory.
 */
export class InMemoryQueues implements MusicQueueDAO {

  private cache: EolianCache<Track[]>;

  constructor(ttl: number) {
    this.cache = new InMemoryCache(ttl);
  }

  async get(guildId: string, limit?: number): Promise<Track[]> {
    const list = await this.cache.get(guildId) || [];
    return limit ? list.slice(0, limit) : list;
  }

  async add(guildId: string, tracks: Track[], head?: boolean): Promise<void> {
    const list = await this.cache.get(guildId) || [];
    const newList = head ? tracks.concat(list) : list.concat(tracks);
    this.cache.set(guildId, newList);
  }

  async shuffle(guildId: string): Promise<boolean> {
    const list = await this.cache.get(guildId);
    if (!list) return false;

    this.cache.set(guildId, Util.shuffle(list));

    return true;
  }

  async clear(guildId: string): Promise<boolean> {
    return this.cache.del(guildId);
  }

  async pop(guildId: string): Promise<Track> {
    const list = await this.cache.get(guildId) || [];
    if (!list.length) {
      return null;
    }

    const track = list.pop();
    this.cache.set(guildId, list);
    return track;
  }

  async peek(guildId: string): Promise<Track> {
    const list = await this.cache.get(guildId) || [];
    return list.length ? list[0] : null;
  }

}