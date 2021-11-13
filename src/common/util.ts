import * as fuzz from 'fuzzball';
import { AbsRangeArgument, RangeArgument, RetrySleepAlgorithm } from './@types';

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

export function convertRangeToAbsolute(range: RangeArgument, max: number, reverse?: boolean): AbsRangeArgument {
  let newStart = 0;
  let newStop = max;

  if (range.stop) {
    newStart = Math.min(max - 1, Math.max(1, range.start) - 1);
    newStop = (range.stop < 0)
      ? max + range.stop + 1
      : Math.min(max - 1, Math.max(1, range.stop) - 1);

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

export function fuzzyMatch(query: string, list: string[]): Promise<{choice: string, score: number, key: number}[]> {
  return fuzz.extractAsPromised(query, list, { scorer: fuzz.token_sort_ratio, returnObjects: true });
}

export const noop = (): void => { /* Do nothing */ };

export class ExponentialSleep implements RetrySleepAlgorithm {

  private _count = 0;

  constructor(private readonly initial = 1000, private readonly multiplier = 2) {
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