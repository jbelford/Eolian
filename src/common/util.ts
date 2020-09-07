import { RangeArgument } from './@types';

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

export function applyRangeToList<T>(range: RangeArgument, list: T[]): T[] {
  if (range.stop) {
    const absStart = Math.max(1, range.start) - 1;
    const absStop = range.stop < 0 ? list.length + range.stop : Math.max(1, range.stop) - 1;
    return list.slice(Math.min(absStart, absStop), Math.max(absStart, absStop));
  }

  return list.slice(Math.max(1, range.start) - 1);
}

export function applyRangeToListReverse<T>(range: RangeArgument, list: T[]): T[] {
  if (range.stop) {
    const absStart = list.length - Math.max(1, range.start);
    const absStop = range.stop < 0 ? Math.abs(range.stop) - 1 : list.length - Math.max(1, range.stop);
    return list.slice(Math.min(absStart, absStop), Math.max(absStart, absStop));
  }

  return list.slice(list.length - Math.max(1, range.start));
}