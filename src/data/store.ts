import { MemoryStore, MusicQueueDAO, PlayerStore } from './@types';
import { InMemoryPlayerStore } from './player';
import { InMemoryQueues } from './queue';

class LocalMemoryStore implements MemoryStore {

  readonly queueDao: MusicQueueDAO;
  readonly playerStore: PlayerStore;

  constructor() {
    this.queueDao = new InMemoryQueues(1000 * 60 * 60 * 3);
    this.playerStore = new InMemoryPlayerStore();
  }

  async close(): Promise<void> {
    return; // Do nothing
  }

}

export async function createMemoryStore(): Promise<MemoryStore> {
  return new LocalMemoryStore();
}
