import NodeCache from 'node-cache';
import { EolianCache, ListCache, MemoryCache } from './@types';

export class InMemoryCache<V> implements EolianCache<V> {
  private cache: NodeCache;

  constructor(
    private readonly ttl: number,
    clone = true,
    private readonly onExpired?: (key: string, value: V) => void,
    private readonly onClose?: (value: V) => Promise<void>
  ) {
    this.cache = new NodeCache({
      stdTTL: this.ttl,
      checkperiod: 300,
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

export class InMemoryListCache<V> implements ListCache<V> {
  private counts = new Map<string, number>();
  private cache: EolianCache<V[]>;

  constructor(private readonly ttl: number) {
    this.cache = new InMemoryCache<V[]>(ttl, false, key => this.counts.delete(key));
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

  async lpeek(key: string, idx = 0): Promise<V | undefined> {
    const values = await this.get(key);
    return idx >= 0 && idx < values.length ? values[idx] : undefined;
  }

  async rpeek(key: string, idx = 0): Promise<V | undefined> {
    const values = await this.get(key);
    idx = values.length - 1 - idx;
    return idx >= 0 && idx < values.length ? values[idx] : undefined;
  }

  async get(key: string): Promise<V[]> {
    const values = (await this.cache.get(key)) ?? [];
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

class CacheNode<T> {
  prev?: CacheNode<T>;
  next?: CacheNode<T>;

  constructor(private _id: string, private _value: T) {}

  get id(): string {
    return this._id;
  }

  get value(): T {
    return this._value;
  }

  reset(id: string, value: T) {
    this._id = id;
    this._value = value;
  }
}

export class InMemoryLRUCache<T> implements MemoryCache<T> {
  private map = new Map<string, CacheNode<T>>();
  private head?: CacheNode<T>;
  private tail?: CacheNode<T>;

  constructor(private readonly size: number) {}

  get(id: string): T | undefined {
    let val: T | undefined;
    const node = this.map.get(id);
    if (node) {
      if (node.prev) {
        this.remove(node);
        this.push(node);
      }
      val = node.value;
    }
    return val;
  }

  set(id: string, val: T): void {
    let node: CacheNode<T>;
    if (this.map.size === this.size && this.tail) {
      node = this.tail;
      this.map.delete(node.id);
      this.remove(node);
      node.reset(id, val);
    } else {
      node = new CacheNode(id, val);
    }
    this.push(node);
    this.map.set(id, node);
  }

  private push(node: CacheNode<T>) {
    if (!this.head) {
      this.head = node;
      this.tail = this.head;
    } else {
      this.head.prev = node;
      node.next = this.head;
      this.head = node;
    }
  }

  private remove(node: CacheNode<T>) {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
    node.prev = undefined;
    node.next = undefined;
  }
}
