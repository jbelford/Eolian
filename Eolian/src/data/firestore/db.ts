import { Firestore } from '@google-cloud/firestore';
import environment from 'environments/env';
import { FirestoreQueues } from './queue';
import { FirestoreUsers } from './users';

export class FirestoreDatabase implements Database {

  readonly usersDao: UsersDAO;

  readonly queuesDao: MusicQueueDAO;

  constructor() {
    const db = new Firestore({
      projectId: environment.google.projectId,
      keyFilename: environment.google.serviceKey.firestore
    });
    this.usersDao = new FirestoreUsers(db);
    this.queuesDao = new FirestoreQueues(db);
  }

  cleanup(): Promise<void> {
    return; // Firestore library is fully managed
  }

}