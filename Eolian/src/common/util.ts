
export namespace Util {

  export function shuffle<T>(list: T[]): T[] {
    for (let i = 0; i < list.length; i++) {
      const rand = Math.random() * list.length;
      const temp = list[rand];
      list[rand] = list[i];
      list[i] = temp;
    }
    return list;
  }

  export function tsum(...values: any[]): number {
    return values.map(value => +!!value).reduce((prev, curr) => prev + curr, 0);
  }

}