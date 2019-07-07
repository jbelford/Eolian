import { logger } from 'common/logger';
import { MongoUsers } from 'data/mongo/users';
import environment from 'environments/env';
import { MongoClient } from 'mongodb';
import { MongoQueues } from './queues';

export class MongoDatabase implements Database {

  public readonly usersDao: UsersDAO;
  public readonly queuesDao: MusicQueueDAO;

  private constructor(private readonly client: MongoClient) {
    logger.info(`Database set: ${environment.mongo.name}`);
    const db = client.db(environment.mongo.name);
    this.usersDao = new MongoUsers(db);
    this.queuesDao = new MongoQueues(db);
  }

  /**
   * Connects to MongoDB and returns MongoDatabase object
   */
  public static async connect(): Promise<MongoDatabase> {
    const client = new MongoClient(environment.mongo.url, { useNewUrlParser: true });
    logger.info(`Connecting to Mongo: ${environment.mongo.url}`);
    await client.connect();
    logger.info(`Connection to Mongo established`);
    return new MongoDatabase(client);
  }

  async cleanup(): Promise<void> {
    await this.client.close();
  }

}