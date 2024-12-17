import { environment } from '@eolian/common/env';
import { logger } from '@eolian/common/logger';
import { MongoClient } from 'mongodb';
import { AppDatabase, UsersDb, ServersDb } from '../@types';
import { MongoServers } from './mongo-servers-collection';
import { MongoUsers } from './mongo-users-collection';

class MongoDatabase implements AppDatabase {
  readonly users: UsersDb;
  readonly servers: ServersDb;

  constructor(private readonly client: MongoClient) {
    const db = client.db(environment.mongo.db_name);
    this.users = new MongoUsers(db.collection('users'));
    this.servers = new MongoServers(db.collection('servers'));
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export async function createDatabase(): Promise<AppDatabase> {
  const client = new MongoClient(environment.mongo.uri);
  try {
    await client.connect();
  } catch (err) {
    logger.error('Failed to connect to DB');
    logger.error(err);
    process.exit(1);
  }
  return new MongoDatabase(client);
}
