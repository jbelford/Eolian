import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDLE_TIMEOUT_MINS } from '@eolian/common/constants';
import { QueueCache } from '@eolian/data/@types';
import { ServerMusicQueue } from '@eolian/framework/server-music-queue';

const track = (title: string) => ({ title }) as never;

function createQueueCache() {
  return {
    size: vi.fn().mockResolvedValue(2),
    pop: vi.fn().mockResolvedValue(track('popped')),
    unpop: vi.fn().mockResolvedValue(true),
    get: vi.fn().mockResolvedValue([track('current')]),
    getLoop: vi.fn().mockResolvedValue([track('looped')]),
    remove: vi.fn().mockResolvedValue(1),
    move: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    shuffle: vi.fn().mockResolvedValue(true),
    clear: vi.fn().mockResolvedValue(true),
    clearPrev: vi.fn().mockResolvedValue(undefined),
    peek: vi.fn().mockResolvedValue(track('next')),
    peekReverse: vi.fn().mockResolvedValue(track('previous')),
  } satisfies QueueCache<never>;
}

describe('ServerMusicQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('delegates reads with the guild id and only includes history in loop mode', async () => {
    const cache = createQueueCache();
    const queue = new ServerMusicQueue(cache, 'guild');

    expect(await queue.size(true)).toBe(2);
    expect(cache.size).toHaveBeenCalledWith('guild', false);
    expect(await queue.peek()).toEqual(track('next'));
    expect(cache.peek).toHaveBeenCalledWith('guild', false);
    expect(await queue.peekReverse(3)).toEqual(track('previous'));
    expect(cache.peekReverse).toHaveBeenCalledWith('guild', 3);

    await queue.setLoopMode(true);
    await queue.size(true);
    await queue.peek();
    expect(cache.size).toHaveBeenLastCalledWith('guild', true);
    expect(cache.peek).toHaveBeenLastCalledWith('guild', true);
  });

  it('fills a short queue window from loop history only when looping', async () => {
    const cache = createQueueCache();
    const queue = new ServerMusicQueue(cache, 'guild');

    expect(await queue.get(4, 3)).toEqual([[track('current')], []]);
    expect(cache.getLoop).not.toHaveBeenCalled();

    await queue.setLoopMode(true);
    expect(await queue.get(4, 3)).toEqual([[track('current')], [track('looped')]]);
    expect(cache.getLoop).toHaveBeenCalledWith('guild', 2);
  });

  it('emits operation-specific and update events after successful mutations', async () => {
    const cache = createQueueCache();
    const queue = new ServerMusicQueue(cache, 'guild');
    const events: string[] = [];
    queue.on('add', () => events.push('add'));
    queue.on('remove', () => events.push('remove'));
    queue.on('update', () => events.push('update'));

    await queue.add([track('one')], true);
    await queue.remove(1, 2);
    await queue.clear();
    await queue.move(0, 2, 1);
    await queue.shuffle();
    await queue.pop();

    expect(cache.add).toHaveBeenCalledWith('guild', [track('one')], true);
    expect(cache.remove).toHaveBeenCalledWith('guild', 1, 2);
    expect(cache.move).toHaveBeenCalledWith('guild', 0, 2, 1);
    expect(cache.pop).toHaveBeenCalledWith('guild', false);
    expect(events).toEqual([
      'add',
      'update',
      'remove',
      'update',
      'remove',
      'update',
      'update',
      'update',
      'update',
    ]);
  });

  it('does not emit or refresh activity when the backing mutation rejects', async () => {
    const cache = createQueueCache();
    cache.add.mockRejectedValueOnce(new Error('storage failed'));
    const queue = new ServerMusicQueue(cache, 'guild');
    const listener = vi.fn();
    queue.on('update', listener);

    await expect(queue.add([track('one')])).rejects.toThrow('storage failed');
    expect(listener).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MINS * 1000);
    expect(queue.idle).toBe(true);
  });

  it('refreshes idle time on updates and ignores redundant loop assignments', async () => {
    const queue = new ServerMusicQueue(createQueueCache(), 'guild');
    const listener = vi.fn();
    queue.on('update', listener);

    await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MINS * 1000 - 1);
    expect(queue.idle).toBe(false);
    await queue.setLoopMode(true);
    expect(listener).toHaveBeenCalledTimes(1);

    await queue.setLoopMode(true);
    expect(listener).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MINS * 1000);
    expect(queue.idle).toBe(true);
  });

  it('delegates unpop and propagates backing return values', async () => {
    const cache = createQueueCache();
    cache.unpop.mockResolvedValueOnce(false);
    const queue = new ServerMusicQueue(cache, 'guild');

    expect(await queue.unpop(4)).toBe(false);
    expect(cache.unpop).toHaveBeenCalledWith('guild', 4);
    expect(await queue.shuffle()).toBe(true);
    expect(await queue.clear()).toBe(true);
  });
});
