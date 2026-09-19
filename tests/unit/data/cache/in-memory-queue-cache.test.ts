import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@eolian/common/util', () => ({
  shuffleList: vi.fn(<T>(values: T[]) => values.reverse()),
}));

import { InMemoryQueueCache } from '@eolian/data/cache/in-memory-queue-cache';

describe('InMemoryQueueCache', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('adds at the head or tail and reads queue windows', async () => {
    const queue = new InMemoryQueueCache<number>(10);
    await queue.add('guild', [2, 3]);
    await queue.add('guild', [0, 1], true);

    expect(await queue.size('guild')).toBe(4);
    expect(await queue.peek('guild')).toBe(0);
    expect(await queue.get('guild', 1, 2)).toEqual([1, 2]);
  });

  it('moves and removes queue ranges while preserving item order', async () => {
    const queue = new InMemoryQueueCache<string>(10);
    await queue.add('guild', ['a', 'b', 'c', 'd']);

    await queue.move('guild', 0, 2, 2);
    expect(await queue.get('guild', 0, 10)).toEqual(['c', 'd', 'a', 'b']);
    expect(await queue.remove('guild', 1, 2)).toBe(2);
    expect(await queue.get('guild', 0, 10)).toEqual(['c', 'b']);
  });

  it('shuffles non-empty queues and reports empty queues', async () => {
    const queue = new InMemoryQueueCache<number>(10);
    expect(await queue.shuffle('missing')).toBe(false);

    await queue.add('guild', [1, 2, 3]);
    expect(await queue.shuffle('guild')).toBe(true);
    expect(await queue.get('guild', 0, 10)).toEqual([3, 2, 1]);
  });

  it('tracks popped items and restores them in original order', async () => {
    const queue = new InMemoryQueueCache<number>(10);
    await queue.add('guild', [1, 2, 3, 4]);
    expect(await queue.pop('guild')).toBe(1);
    expect(await queue.pop('guild')).toBe(2);
    expect(await queue.peekReverse('guild')).toBe(2);
    expect(await queue.peekReverse('guild', 1)).toBe(1);

    expect(await queue.unpop('guild', 2)).toBe(true);
    expect(await queue.get('guild', 0, 10)).toEqual([1, 2, 3, 4]);
    expect(await queue.unpop('guild', 1)).toBe(false);
  });

  it('retains the ten most recently popped items for non-looping queues', async () => {
    const queue = new InMemoryQueueCache<number>(10);
    await queue.add(
      'guild',
      Array.from({ length: 12 }, (_, index) => index + 1),
    );

    for (let index = 0; index < 12; index++) {
      await queue.pop('guild');
    }

    expect(await queue.getLoop('guild', 20)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(await queue.unpop('guild', 10)).toBe(true);
    expect(await queue.get('guild', 0, 20)).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('cycles looped items in playback order when the active queue is exhausted', async () => {
    const queue = new InMemoryQueueCache<string>(10);
    await queue.add('guild', ['a', 'b', 'c']);

    expect(await queue.pop('guild', true)).toBe('a');
    expect(await queue.pop('guild', true)).toBe('b');
    expect(await queue.pop('guild', true)).toBe('c');
    expect(await queue.size('guild')).toBe(0);
    expect(await queue.size('guild', true)).toBe(3);
    expect(await queue.peek('guild', true)).toBe('a');
    expect(await queue.pop('guild', true)).toBe('a');
    expect(await queue.getLoop('guild', 3)).toEqual(['b', 'c', 'a']);
  });

  it('clears current and previous entries and expires queue state', async () => {
    const queue = new InMemoryQueueCache<number>(1);
    await queue.add('guild', [1, 2]);
    await queue.pop('guild');
    expect(await queue.clear('guild')).toBe(true);
    expect(await queue.size('guild', true)).toBe(0);

    await queue.add('guild', [3]);
    await vi.advanceTimersByTimeAsync(1001);
    expect(await queue.peek('guild')).toBeUndefined();
  });
});
