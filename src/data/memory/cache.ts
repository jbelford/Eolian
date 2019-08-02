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

}