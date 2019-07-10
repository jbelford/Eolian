import { Firestore } from '@google-cloud/firestore';
import { FirestoreUsers } from './users';

export class FirestoreDatabase implements Database {

  readonly usersDao: UsersDAO;

  constructor() {
    const db = new Firestore();
    this.usersDao = new FirestoreUsers(db);
  }

  async close(): Promise<void> {
    return; // Firestore library is fully managed
  }

}