import { Util } from 'common/util';
import * as NodeCache from 'node-cache';

/**
 * Temporary implementation storing music queues in-memory.
 */
export class InMemoryQueues implements MusicQueueDAO {

  private cache: NodeCache;

  constructor(private readonly ttl: number) {
    this.cache = new NodeCache({ stdTTL: ttl });
  }

  async get(guildId: string, limit?: number): Promise<Track[]> {
    const list = this.cache.get<Track[]>(guildId) || [];
    return limit ? list.slice(0, limit) : list;
  }

  async add(guildId: string, tracks: Track[], head?: boolean): Promise<void> {
    const list = this.cache.get<Track[]>(guildId) || [];
    const newList = head ? tracks.concat(list) : list.concat(tracks);
    this.cache.set<Track[]>(guildId, newList, this.ttl);
  }

  async shuffle(guildId: string): Promise<boolean> {
    const list = this.cache.get<Track[]>(guildId);
    if (!list) return false;

    this.cache.set<Track[]>(guildId, Util.shuffle(list), this.ttl);

    return true;
  }

  async clear(guildId: string): Promise<boolean> {
    return this.cache.del(guildId) > 0;
  }

  async pop(guildId: string): Promise<Track> {
    const list = this.cache.get<Track[]>(guildId) || [];
    if (!list.length) {
      return null;
    }

    const track = list.pop();
    this.cache.set<Track[]>(guildId, list, this.ttl);
    return track;
  }

  async peek(guildId: string): Promise<Track> {
    const list = this.cache.get<Track[]>(guildId) || [];
    return list.length ? list[0] : null;
  }

}