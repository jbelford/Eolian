import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LockManager } from '@eolian/data/lock-manager';

describe('LockManager', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('locks and unlocks identifiers independently', async () => {
    const locks = new LockManager(10);

    expect(await locks.isLocked('a')).toBe(false);
    await locks.lock('a');
    expect(await locks.isLocked('a')).toBe(true);
    expect(await locks.isLocked('b')).toBe(false);
    await locks.unlock('a');
    expect(await locks.isLocked('a')).toBe(false);
  });

  it('automatically releases locks after the timeout', async () => {
    const locks = new LockManager(1);
    await locks.lock('a');

    await vi.advanceTimersByTimeAsync(999);
    expect(await locks.isLocked('a')).toBe(true);
    await vi.advanceTimersByTimeAsync(2);
    expect(await locks.isLocked('a')).toBe(false);
  });
});
