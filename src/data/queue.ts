import { AbsRangeArgument } from 'common/@types';
import { shuffleList } from 'common/util';
import { Track } from 'music/@types';
import { EolianCache, MusicQueueDAO } from './@types';
import { InMemoryCache } from './cache';

/**
 * Temporary implementation storing music queues in-memory.
 */
export class InMemoryQueues implements MusicQueueDAO {

  private cache: EolianCache;

  constructor(ttl: number) {
    this.cache = new InMemoryCache(ttl);
  }

  async get(guildId: string, limit?: number): Promise<Track[]> {
    const list = await this.cache.get<Track[]>(guildId) || [];
    return limit ? list.slice(0, limit) : list;
  }

  async remove(guildId: string, range: AbsRangeArgument): Promise<number> {
    const list = await this.cache.get<Track[]>(guildId) || [];
    const newList = list.slice(0, range.start).concat(list.slice(range.stop));
    this.cache.set(guildId, newList);
    return range.stop - range.start;
  }

  async add(guildId: string, tracks: Track[], head?: boolean): Promise<void> {
    const list = await this.cache.get<Track[]>(guildId) || [];
    const newList = head ? tracks.concat(list) : list.concat(tracks);
    this.cache.set(guildId, newList);
  }

  async shuffle(guildId: string): Promise<boolean> {
    const list = await this.cache.get<Track[]>(guildId);
    if (!list) return false;

    this.cache.set(guildId, shuffleList(list));

    return true;
  }

  async clear(guildId: string): Promise<boolean> {
    return this.cache.del(guildId);
  }

  async pop(guildId: string): Promise<Track | undefined> {
    const list = await this.cache.get<Track[]>(guildId) || [];
    if (!list.length) {
      return;
    }

    const track = list.shift();
    this.cache.set(guildId, list);
    return track;
  }

  async peek(guildId: string): Promise<Track | undefined> {
    const list = await this.cache.get<Track[]>(guildId) || [];
    return list.length ? list[0] : undefined;
  }

}