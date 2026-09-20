import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const logger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@eolian/common/logger', () => ({ logger }));

import {
  ExponentialSleep,
  clampLength,
  cleanupOnExit,
  convertRangeToAbsolute,
  fuzzyMatch,
  noop,
  promiseTimeout,
  shuffleList,
  sleep,
  truthySum,
} from '@eolian/common/util';

const signals: NodeJS.Signals[] = [
  'SIGHUP',
  'SIGINT',
  'SIGQUIT',
  'SIGILL',
  'SIGTRAP',
  'SIGABRT',
  'SIGBUS',
  'SIGFPE',
  'SIGUSR1',
  'SIGSEGV',
  'SIGUSR2',
  'SIGTERM',
];

describe('common utilities', () => {
  it('shuffles in place using each generated position', () => {
    vi.spyOn(Math, 'random')
      .mockReturnValueOnce(0.75)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.25);
    const values = ['a', 'b', 'c', 'd'];

    expect(shuffleList(values)).toBe(values);
    expect(values).toEqual(['b', 'a', 'c', 'd']);
  });

  it('counts values using JavaScript truthiness', () => {
    expect(truthySum(true, false, 1, 0, 'value', '', [], null, undefined)).toBe(4);
    expect(truthySum()).toBe(0);
  });

  it.each([
    [{ start: 3 }, 10, false, { start: 0, stop: 3 }],
    [{ start: 20 }, 10, false, { start: 0, stop: 10 }],
    [{ start: 2, stop: 4 }, 10, false, { start: 1, stop: 4 }],
    [{ start: 5, stop: -5 }, 20, false, { start: 4, stop: 16 }],
    [{ start: 3 }, 10, true, { start: 7, stop: 10 }],
    [{ start: 4, stop: 10 }, 20, true, { start: 10, stop: 17 }],
    [{ start: 5, stop: -5 }, 20, true, { start: 4, stop: 16 }],
    [{ start: 1 }, 0, false, { start: 0, stop: 0 }],
  ] as const)('converts one-based ranges into slice bounds', (range, max, reverse, expected) => {
    expect(convertRangeToAbsolute(range, max, reverse)).toEqual(expected);
  });

  describe('timing helpers', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('resolves sleep only after its delay', async () => {
      const result = vi.fn();
      const pending = sleep(25).then(result);

      await vi.advanceTimersByTimeAsync(24);
      expect(result).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(result).toHaveBeenCalledOnce();
    });

    it('returns a settled promise and clears the losing timeout', async () => {
      await expect(promiseTimeout(Promise.resolve('done'), 100)).resolves.toBe('done');
      expect(vi.getTimerCount()).toBe(0);
    });

    it('rejects promises that exceed the timeout', async () => {
      const result = promiseTimeout(new Promise<string>(() => undefined), 100);
      const expectation = expect(result).rejects.toBe('timeout');

      await vi.advanceTimersByTimeAsync(100);
      await expectation;
      expect(vi.getTimerCount()).toBe(0);
    });

    it('uses exponential delays and can reset retry state', async () => {
      const retry = new ExponentialSleep(10, 3);

      for (const [delay, count] of [
        [10, 1],
        [30, 2],
      ] as const) {
        const pending = retry.sleep();
        await vi.advanceTimersByTimeAsync(delay - 1);
        expect(retry.count).toBe(count - 1);
        await vi.advanceTimersByTimeAsync(1);
        await pending;
        expect(retry.count).toBe(count);
      }

      retry.reset();
      expect(retry.count).toBe(0);
    });
  });

  it.each([
    [0, 2],
    [-1, 2],
    [1, 0],
  ])('rejects invalid exponential sleep arguments (%s, %s)', (initial, multiplier) => {
    expect(() => new ExponentialSleep(initial, multiplier)).toThrow('Bad arguments provided!');
  });

  it('ranks close fuzzy matches ahead of unrelated choices', async () => {
    const results = await fuzzyMatch('daft punk', ['Punk Rock', 'Daft Punk', 'Classical']);

    expect(results[0]).toMatchObject({ choice: 'Daft Punk', key: 1 });
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });

  it.each([
    ['abcdef', 6, 'abcdef'],
    ['abcdef', 5, 'abc..'],
    ['abcdef', 2, '..'],
    ['abcdef', 1, '.'],
    ['abcdef', 0, ''],
  ])('clamps %j to length %i', (value, length, expected) => {
    expect(clampLength(value, length)).toBe(expected);
  });

  it('provides a no-op callback', () => {
    expect(noop()).toBeUndefined();
  });
});

describe('cleanupOnExit', () => {
  const originalListeners = new Map<string, Function[]>();

  beforeEach(() => {
    originalListeners.set('exit', process.listeners('exit'));
    for (const signal of signals) {
      originalListeners.set(signal, process.listeners(signal));
    }
  });

  afterEach(() => {
    const originalExit = originalListeners.get('exit') ?? [];
    for (const listener of process.listeners('exit')) {
      if (!originalExit.includes(listener)) {
        process.removeListener('exit', listener);
      }
    }
    for (const signal of signals) {
      const original = originalListeners.get(signal) ?? [];
      for (const listener of process.listeners(signal)) {
        if (!original.includes(listener)) {
          process.removeListener(signal, listener);
        }
      }
    }
    originalListeners.clear();
  });

  it('closes every resource and logs failures on the exit event', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const error = new Error('close failed');
    const failingClose = vi.fn().mockRejectedValue(error);
    const before = process.listeners('exit');

    cleanupOnExit([{ close }, { close: failingClose }]);
    const listener = process.listeners('exit').find(candidate => !before.includes(candidate));
    expect(listener).toBeDefined();

    listener!(0);
    await vi.waitFor(() => expect(failingClose).toHaveBeenCalledOnce());
    await vi.waitFor(() =>
      expect(logger.warn).toHaveBeenCalledWith('Failed to clean resource: %s', error),
    );
    expect(close).toHaveBeenCalledOnce();
    expect(process.listeners('exit')).not.toContain(listener);
  });

  it('logs a signal, cleans resources, and exits only after cleanup settles', async () => {
    let finishClose!: () => void;
    const close = vi.fn(
      () =>
        new Promise<void>(resolve => {
          finishClose = resolve;
        }),
    );
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const before = process.listeners('SIGTERM');

    cleanupOnExit([{ close }]);
    const listener = process.listeners('SIGTERM').find(candidate => !before.includes(candidate));
    expect(listener).toBeDefined();

    listener!('SIGTERM');
    expect(logger.warn).toHaveBeenCalledWith('Received %s', 'SIGTERM');
    expect(close).toHaveBeenCalledOnce();
    expect(exit).not.toHaveBeenCalled();

    finishClose();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(1));
  });
});
