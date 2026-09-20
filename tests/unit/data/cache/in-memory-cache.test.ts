import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryCache } from '@eolian/data/cache/in-memory-cache';

describe('InMemoryCache', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('stores cloned values by default and deletes keys', async () => {
    const cache = new InMemoryCache<{ count: number }>(10, true, undefined, undefined, 0);
    const value = { count: 1 };

    expect(await cache.set('key', value)).toBe(true);
    value.count = 2;
    expect(await cache.get('key')).toEqual({ count: 1 });
    expect(await cache.del('key')).toBe(true);
    expect(await cache.del('key')).toBe(false);
    expect(await cache.get('key')).toBeUndefined();
    await cache.close();
  });

  it('expires values at their TTL and invokes the expiry callback', async () => {
    const expired = vi.fn();
    const cache = new InMemoryCache<string>(1, true, expired, undefined, 0);
    await cache.set('key', 'value');

    await vi.advanceTimersByTimeAsync(999);
    expect(await cache.get('key')).toBe('value');
    await vi.advanceTimersByTimeAsync(2);
    expect(await cache.get('key')).toBeUndefined();
    expect(expired).toHaveBeenCalledWith('key', 'value');
    await cache.close();
  });

  it('supports per-entry TTL overrides and refreshes the default TTL', async () => {
    const cache = new InMemoryCache<string>(2, true, undefined, undefined, 0);
    await cache.set('key', 'value', 1);

    await vi.advanceTimersByTimeAsync(901);
    expect(await cache.refreshTTL('key')).toBe(true);
    await vi.advanceTimersByTimeAsync(1100);
    expect(await cache.get('key')).toBe('value');
    await vi.advanceTimersByTimeAsync(1001);
    expect(await cache.get('key')).toBeUndefined();
    expect(await cache.refreshTTL('missing')).toBe(false);
    await cache.close();
  });

  it('settles all close callbacks and clears every value', async () => {
    const onClose = vi
      .fn<(value: string) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('ignored'));
    const cache = new InMemoryCache<string>(10, true, undefined, onClose, 0);
    await cache.set('a', 'first');
    await cache.set('b', 'second');

    await expect(cache.close()).resolves.toBeUndefined();
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onClose.mock.calls.map(([value]) => value).sort()).toEqual(['first', 'second']);
    expect(await cache.get('a')).toBeUndefined();
  });
});
