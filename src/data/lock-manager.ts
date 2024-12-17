import { EolianCache } from './@types';
import { InMemoryCache } from './cache/in-memory-cache';

export class LockManager {
  private readonly cache: EolianCache<boolean>;

  constructor(timeout: number) {
    this.cache = new InMemoryCache(timeout);
  }

  async isLocked(id: string): Promise<boolean> {
    return !!(await this.cache.get(id));
  }

  async lock(id: string): Promise<void> {
    await this.cache.set(id, true);
  }

  async unlock(id: string): Promise<void> {
    await this.cache.set(id, false);
  }
}
