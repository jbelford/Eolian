import NodeCache from 'node-cache';
import { EolianCache } from './@types';

export class InMemoryCache implements EolianCache {

  private cache: NodeCache;

  constructor(private readonly ttl: number) {
    this.cache = new NodeCache({ stdTTL: ttl });
  }

  async get<T>(id: string): Promise<T | undefined> {
    return this.cache.get<T>(id);
  }

  async del(id: string): Promise<boolean> {
    return this.cache.del(id) > 0;
  }

  async set<T>(id: string, val: T, ttl = this.ttl): Promise<boolean> {
    return this.cache.set(id, val, ttl);
  }

  async mset<T>(pairs: Array<{ id: string, val: T }>): Promise<number> {
    let count = 0;
    for (const pair of pairs) {
      if (this.cache.set(pair.id, pair.val, this.ttl)) {
        count++;
      }
    }
    return count;
  }

  async getOrSet<T>(id: string, fn: () => PromiseLike<T> | T): Promise<[T, boolean]> {
    let result = await this.get<T>(id);
    let found = true;
    if (!result) {
      result = await Promise.resolve(fn());
      await this.set(id, result);
      found = false;
    }
    return [result, found];
  }

}