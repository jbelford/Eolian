import { CollectionReference, Firestore } from '@google-cloud/firestore';

export class FirestoreQueues implements MusicQueueDAO {

  private readonly queues: CollectionReference;

  constructor(firestore: Firestore) {
    this.queues = firestore.collection('queues');
  }

  get(guildId: string, limit?: number): Promise<Track[]> {
    throw new Error('Method not implemented.');
  }

  add(guildId: string, tracks: Track[], head?: boolean): Promise<void> {
    throw new Error('Method not implemented.');
  }

  shuffle(guildId: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  clear(guildId: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  remove(guildId: string): Promise<Track> {
    throw new Error('Method not implemented.');
  }

  peek(guildId: string): Promise<Track> {
    throw new Error('Method not implemented.');
  }

}