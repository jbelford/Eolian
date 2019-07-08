import { logger } from 'common/logger';
import { MongoUsers } from 'data/mongo/users';
import environment from 'environments/env';
import { MongoClient } from 'mongodb';

export class MongoDatabase implements Database {

  public readonly usersDao: UsersDAO;

  private constructor(private readonly client: MongoClient) {
    logger.info(`Database set: ${environment.mongo.name}`);
    const db = client.db(environment.mongo.name);
    this.usersDao = new MongoUsers(db);
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

  async close(): Promise<void> {
    await this.client.close();
  }

}