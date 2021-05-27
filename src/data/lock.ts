import { InMemoryCache } from 'data';
import { EolianCache } from './@types';

export class UserLockManager {

  private readonly cache: EolianCache<boolean>;

  constructor(timeout: number) {
    this.cache = new InMemoryCache(timeout);
  }

  async isLocked(id: string): Promise<boolean> {
    return !!(await this.cache.get(id));
  }

  async lockUser(id: string): Promise<void> {
    await this.cache.set(id, true);
  }

  async unlockUser(id: string): Promise<void> {
    await this.cache.set(id, false);
  }

}
