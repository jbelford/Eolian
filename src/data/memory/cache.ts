import * as NodeCache from 'node-cache';

export class InMemoryCache<T> implements EolianCache<T> {

  private cache: NodeCache;

  constructor(private readonly ttl: number) {
    this.cache = new NodeCache({ stdTTL: ttl });
  }

  async get(id: string): Promise<T> {
    return this.cache.get<T>(id);
  }

  async del(id: string): Promise<boolean> {
    return this.cache.del(id) > 0;
  }

  async set(id: string, val: T, ttl = this.ttl): Promise<boolean> {
    return this.cache.set(id, val, ttl);
  }

  async getOrSet(id: string, fn: () => PromiseLike<T> | T): Promise<T> {
    let result = await this.get(id);
    if (!result) {
      result = await Promise.resolve(fn());
      await this.set(id, result);
    }
    return result;
  }

}