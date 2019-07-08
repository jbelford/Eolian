import { Firestore } from '@google-cloud/firestore';
import environment from 'environments/env';
import { FirestoreUsers } from './users';

export class FirestoreDatabase implements Database {

  readonly usersDao: UsersDAO;

  constructor() {
    const db = new Firestore({
      projectId: environment.google.projectId,
      keyFilename: environment.google.serviceKey.firestore
    });
    this.usersDao = new FirestoreUsers(db);
  }

  async close(): Promise<void> {
    return; // Firestore library is fully managed
  }

}