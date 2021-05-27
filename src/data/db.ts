import { environment } from 'common/env';
import { logger } from 'common/logger';
import { MongoClient } from 'mongodb';
import { AppDatabase, UsersDb } from './@types';
import { MongoUsers } from './users';

class MongoDatabase implements AppDatabase {

  readonly users: UsersDb;

  constructor(private readonly client: MongoClient) {
    const db = client.db(environment.mongo.db_name);
    this.users = new MongoUsers(db.collection('users'));
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export async function createDatabase() : Promise<AppDatabase> {
  const client = new MongoClient(environment.mongo.uri, { useNewUrlParser: true, useUnifiedTopology: true });
  try {
    await client.connect();
  } catch (err) {
    logger.error('Failed to connect to DB');
    logger.error(err);
    process.exit(1);
  }
  return new MongoDatabase(client);
}
