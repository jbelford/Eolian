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
      logger.info('%s guild state expired', key);
      if (value.player.idle && value.queue.idle) {
        logger.info('%s deleting idle guild state', key);
        await Promise.allSettled([
          value.player.close(),
          value.display.player.close(),
          value.display.queue.close()
        ]);
      } else {
        logger.info('%s stopping partially idle guild state', key);
        if (value.player.idle) {
          await value.display.player.removeIdle();
          await value.player.stop();
        } else if (value.queue.idle) {
          await value.display.queue.removeIdle();
        }
        await this.cache.set(key, value);
      }
      await Promise.allSettled(value.disposable.map(d => d.close()));
    } catch (e) {
      logger.warn(`Error occured clearing guild state: %s`, e);
    }
  };
}