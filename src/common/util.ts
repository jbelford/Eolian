import * as fuzz from 'fuzzball';
import { AbsRangeArgument, Closable, RangeArgument, RetrySleepAlgorithm } from './@types';
import { logger } from './logger';

export function shuffleList<T>(list: T[]): T[] {
  for (let i = 0; i < list.length; i++) {
    const rand = Math.floor(Math.random() * list.length);
    const temp = list[rand];
    list[rand] = list[i];
    list[i] = temp;
  }
  return list;
}

export function truthySum(...values: unknown[]): number {
  return values.map(value => +!!value).reduce((prev, curr) => prev + curr, 0);
}

export function convertRangeToAbsolute(
  range: RangeArgument,
  max: number,
  reverse?: boolean,
): AbsRangeArgument {
  let newStart = 0;
  let newStop = max;

  if (range.stop) {
    newStart = Math.min(max - 1, Math.max(1, range.start) - 1);
    newStop =
      range.stop < 0 ? max + range.stop + 1 : Math.min(max - 1, Math.max(1, range.stop) - 1);

    if (reverse) {
      newStart = max - newStart;
      if (range.stop) {
        newStop = max - newStop;
      }
    }
  } else if (reverse) {
    newStart = max - Math.min(max, Math.max(1, range.start));
  } else {
    newStop = range.start;
  }

  return { start: Math.min(newStart, newStop), stop: Math.max(newStart, newStop) };
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function promiseTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<T>((_resolve, reject) => {
    setTimeout(() => reject('timeout'), ms);
  });
  return Promise.race([promise, timeout]);
}

export function fuzzyMatch(
  query: string,
  list: string[],
): Promise<{ choice: string; score: number; key: number }[]> {
  return fuzz.extractAsPromised(query, list, {
    scorer: fuzz.token_sort_ratio,
    returnObjects: true,
  });
}

export const noop = (): void => {
  /* Do nothing */
};

export class ExponentialSleep implements RetrySleepAlgorithm {
  private _count = 0;

  constructor(
    private readonly initial = 1000,
    private readonly multiplier = 2,
  ) {
    if (initial <= 0 || multiplier <= 0) {
      throw new Error('Bad arguments provided!');
    }
  }

  get count() {
    return this._count;
  }

  reset() {
    this._count = 0;
  }

  async sleep(): Promise<void> {
    await sleep(this.initial * this.multiplier ** this.count);
    ++this._count;
  }
}

export function cleanupOnExit(resources: Closable[]) {
  const exitCb = () => onExit();

  process.on('exit', exitCb);

  const onExit = (exit?: boolean) => {
    process.removeListener('exit', exitCb);

    logger.info('Executing cleanup');

    const promises = resources.map(x =>
      x.close().catch(err => logger.warn(`Failed to clean resource: %s`, err)),
    );

    Promise.all(promises).finally(() => {
      if (exit) {
        process.exit(1);
      }
    });
  };

  [
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
  ].forEach(sig => {
    process.on(sig, () => {
      logger.warn('Received %s', sig);
      onExit(true);
    });
  });
}

export function clampLength(str: string, length: number) {
  if (str.length > length) {
    str = str.substring(0, length - 2);
    str += '..';
  }
  return str;
}
