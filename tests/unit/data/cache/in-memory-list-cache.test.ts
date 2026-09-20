import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryListCache } from '@eolian/data/cache/in-memory-list-cache';

describe('InMemoryListCache', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('pushes, peeks, pops, and reports size from both ends', async () => {
    const cache = new InMemoryListCache<number>(10);
    await cache.rpush('list', [2, 3]);
    await cache.lpush('list', [0, 1]);

    expect(await cache.size('list')).toBe(4);
    expect(await cache.lpeek('list')).toBe(0);
    expect(await cache.lpeek('list', 3)).toBe(3);
    expect(await cache.rpeek('list')).toBe(3);
    expect(await cache.rpeek('list', 3)).toBe(0);
    expect(await cache.lpop('list', 2)).toEqual([0, 1]);
    expect(await cache.rpop('list', 5)).toEqual([2, 3]);
    expect(await cache.get('list')).toEqual([]);
    await cache.close();
  });

  it('ranges and removes values without affecting other positions', async () => {
    const cache = new InMemoryListCache<string>(10);
    await cache.set('list', ['a', 'b', 'c', 'd']);

    expect(await cache.range('list', 1, 2)).toEqual(['b', 'c']);
    expect(await cache.remove('list', 1, 2)).toBe(2);
    expect(await cache.get('list')).toEqual(['a', 'd']);
    expect(await cache.remove('missing', 0, 1)).toBe(0);
    await cache.close();
  });

  it('returns undefined for out-of-range peeks and false for absent deletion', async () => {
    const cache = new InMemoryListCache<number>(10);

    expect(await cache.lpeek('missing', -1)).toBeUndefined();
    expect(await cache.rpeek('missing', 0)).toBeUndefined();
    expect(await cache.del('missing')).toBe(false);
    await cache.close();
  });

  it('expires list contents and cached size together', async () => {
    const cache = new InMemoryListCache<number>(1);
    await cache.set('list', [1, 2]);
    expect(await cache.size('list')).toBe(2);

    await vi.advanceTimersByTimeAsync(1001);
    expect(await cache.get('list')).toEqual([]);
    expect(await cache.size('list')).toBe(0);
    await cache.close();
  });
});
