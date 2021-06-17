import NodeCache from 'node-cache';
import { EolianCache, ListCache } from './@types';

export class InMemoryCache<V> implements EolianCache<V> {

  private cache: NodeCache;

  constructor(private readonly ttl: number, clone = true,
      private readonly onExpired?: (key: string, value: V) => void) {
    this.cache = new NodeCache({ stdTTL: this.ttl, checkperiod: 300,  useClones: clone, deleteOnExpire: true });
    if (this.onExpired) {
      this.cache.on('del', this.onExpired);
    }
  }

  async close(): Promise<void> {
    if (this.onExpired) {
      this.cache.removeListener('del', this.onExpired);
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

  async refreshTTL(key: string): Promise<boolean> {
    return this.cache.ttl(key, this.ttl);
  }

}

export class InMemoryListCache<V> implements ListCache<V> {

  private counts = new Map<string, number>();
  private cache: EolianCache<V[]>;

  constructor(private readonly ttl: number) {
    this.cache = new InMemoryCache<V[]>(ttl);
  }

  async size(key: string): Promise<number> {
    let value = this.counts.get(key);
    if (!value) {
      const values = await this.get(key);
      value = values.length;
    }
    return value;
  }

  async lpop(key: string, count = 1): Promise<V[]> {
    const values = await this.get(key);
    const value = values.splice(0, count);
    if (value) {
      await this.set(key, values);
    }
    return value;
  }

  async rpop(key: string, count = 1): Promise<V[]> {
    const values = await this.get(key);
    const value = values.splice(Math.max(0, values.length - count), count);
    if (value) {
      await this.set(key, values);
    }
    return value;
  }

  async lpush(key: string, items: V[]): Promise<void> {
    let values = await this.get(key);
    values = items.concat(values);
    await this.set(key, values);
  }

  async rpush(key: string, items: V[]): Promise<void> {
    let values = await this.get(key);
    values = values.concat(items);
    await this.set(key, values);
  }

  async peek(key: string, idx = 0): Promise<V | undefined> {
    const values = await this.get(key);
    return idx >= 0 && idx < values.length ? values[idx] : undefined;
  }

  async get(key: string): Promise<V[]> {
    const values = await this.cache.get(key) ?? [];
    this.counts.set(key, values.length);
    return values;
  }

  async set(key: string, items: V[]): Promise<void> {
    this.counts.set(key, items.length);
    await this.cache.set(key, items, this.ttl);
  }

  del(key: string): Promise<boolean> {
    this.counts.delete(key);
    return this.cache.del(key);
  }

  async range(key: string, offset: number, count: number): Promise<V[]> {
    const values = await this.get(key);
    return values.slice(offset, offset + count);
  }

  async remove(key: string, offset: number, count: number): Promise<number> {
    const values = await this.get(key);
    const removed = values.splice(offset, count);
    await this.set(key, values);
    return removed.length;
  }

  async close(): Promise<void> {
    await this.cache.close();
  }

}