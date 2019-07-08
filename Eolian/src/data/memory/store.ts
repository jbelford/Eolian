import { InMemoryQueues } from './queue';

export class LocalMemoryStore implements MemoryStore {

  readonly queueDao: MusicQueueDAO;

  constructor() {
    this.queueDao = new InMemoryQueues(1000 * 60 * 60 * 3);
  }

  async close(): Promise<void> {
    return; // Do nothing
  }

}