import { logger } from 'common/logger';
import { InMemoryCache } from 'data';
import { EolianCache } from 'data/@types';
import { ServerState, ServerStateStore } from './@types';


export class InMemoryServerStateStore implements ServerStateStore {

  private cache: EolianCache<ServerState>;

  constructor(private readonly ttl: number) {
    this.cache = new InMemoryCache(this.ttl, false, this.onExpired);
  }

  async get(guildId: string): Promise<ServerState | undefined> {
    const state = await this.cache.get(guildId);
    if (state) {
      await this.cache.refreshTTL(guildId);
    }
    return state;
  }

  async set(guildId: string, context: ServerState): Promise<void> {
    await this.cache.set(guildId, context, this.ttl);
  }

  private onExpired = async (key: string, value: ServerState) => {
    try {
      logger.debug(`${key} guild state expired`);
      if (value.player.idle && value.queue.idle) {
        logger.debug(`${key} deleting idle guild state`);
        await Promise.allSettled([
          value.player.close(),
          value.display.player.close(),
          value.display.queue.close()
        ]);
      } else {
        logger.debug(`${key} stopping partially idle guild state`);
        if (value.player.idle) {
          await value.display.player.removeIdle();
          await value.player.stop();
        } else if (value.queue.idle) {
          await value.display.queue.removeIdle();
        }
        await this.cache.set(key, value);
      }
    } catch (e) {
      logger.warn(`Error occured clearing guild state ${e}`);
    }
  };
}