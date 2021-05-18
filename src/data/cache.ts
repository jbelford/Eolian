import NodeCache from 'node-cache';
import { EolianCache } from './@types';

export class InMemoryCache<V> implements EolianCache<V> {

  private cache: NodeCache;

  constructor(private readonly ttl: number, clone = true,
      private readonly onExpired?: (key: string, value: V) => void) {
    this.cache = new NodeCache({ stdTTL: this.ttl, useClones: clone, deleteOnExpire: !this.onExpired });
    if (this.onExpired) {
      this.cache.on('expired', this.onExpired);
    }
  }

  async close(): Promise<void> {
    if (this.onExpired) {
      this.cache.removeListener('expired', this.onExpired);
    }
    this.cache.flushAll();
    this.cache.close();
  }

  async get(key: string): Promise<V | undefined> {
    return this.cache.get<V>(key);
  }

  async del(key: string): Promise<boolean> {
    return this.cache.del(key) > 0;
  }

  async set(key: string, val: V, ttl = this.ttl): Promise<boolean> {
    return this.cache.set<V>(key, val, ttl);
  }

}