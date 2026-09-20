import { describe, expect, it } from 'vitest';
import { InMemoryLRUCache } from '@eolian/data/cache/in-memory-lru-cache';

describe('InMemoryLRUCache', () => {
  it('evicts the least recently used entry at capacity', () => {
    const cache = new InMemoryLRUCache<number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);

    cache.set('c', 3);

    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });

  it('updates an existing key without corrupting recency or capacity', () => {
    const cache = new InMemoryLRUCache<number>(2);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('a', 10);
    cache.set('c', 3);

    expect(cache.get('a')).toBe(10);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')).toBe(3);
  });

  it('deletes entries by setting undefined', () => {
    const cache = new InMemoryLRUCache<number>(1);
    cache.set('a', 1);
    cache.set('a', undefined);

    expect(cache.get('a')).toBeUndefined();
    cache.set('b', 2);
    expect(cache.get('b')).toBe(2);
  });

  it('does not retain values when capacity is zero', () => {
    const cache = new InMemoryLRUCache<number>(0);
    cache.set('a', 1);
    expect(cache.get('a')).toBeUndefined();
  });
});
