import { MemoryStore, MusicQueueCache } from './@types';
import { InMemoryQueues } from './queue';

class LocalMemoryStore implements MemoryStore {

  readonly queueDao: MusicQueueCache;

  constructor() {
    this.queueDao = new InMemoryQueues(60 * 60 * 3);
  }

  async close(): Promise<void> {
    return; // Do nothing
  }

}

export async function createMemoryStore(): Promise<MemoryStore> {
  return new LocalMemoryStore();
}
