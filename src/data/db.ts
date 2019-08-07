import { Firestore } from '@google-cloud/firestore';
import { Database, UsersDAO } from './@types';
import { FirestoreUsers } from './users';

export class FirestoreDatabase implements Database {

  readonly users: UsersDAO;

  constructor() {
    const db = new Firestore();
    this.users = new FirestoreUsers(db);
  }

  async close(): Promise<void> {
    return; // Firestore library is fully managed
  }

}