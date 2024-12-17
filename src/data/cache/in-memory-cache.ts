import NodeCache from 'node-cache';
import { EolianCache } from '../@types';

export class InMemoryCache<V> implements EolianCache<V> {
  private cache: NodeCache;

  constructor(
    private readonly ttl: number,
    clone = true,
    private readonly onExpired?: (key: string, value: V) => void,
    private readonly onClose?: (value: V) => Promise<void>,
    checkPeriod = 300,
  ) {
    this.cache = new NodeCache({
      stdTTL: this.ttl,
      checkperiod: checkPeriod,
      useClones: clone,
      deleteOnExpire: true,
    });
    if (this.onExpired) {
      this.cache.on('del', this.onExpired);
    }
  }

  async close(): Promise<void> {
    if (this.onExpired) {
      this.cache.removeListener('del', this.onExpired);
    }

    let promises: Promise<void>[] | undefined;
    if (this.onClose) {
      promises = this.cache.keys().map(key => this.onClose!(this.cache.get(key)!));
    }

    this.cache.flushAll();
    this.cache.close();

    if (promises) {
      await Promise.allSettled(promises);
    }
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

  async refreshTTL(key: string): Promise<boolean> {
    return this.cache.ttl(key, this.ttl);
  }
}
