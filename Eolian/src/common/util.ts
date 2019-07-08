
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

}