import { Collection, Filter, UpdateFilter } from 'mongodb';
import { SessionDTO, SessionsDb } from '../@types';
import { MongoCollection } from './mongo-collection';

export class MongoSessions extends MongoCollection<SessionDTO> implements SessionsDb {
  constructor(collection: Collection<SessionDTO>) {
    super(collection);
  }

  async initialize(): Promise<void> {
    await this.collection.createIndex(
      { expiresAt: 1 },
      { name: 'sessions_expires_at_ttl', expireAfterSeconds: 0 },
    );
  }

  async create(session: SessionDTO): Promise<void> {
    await this.collection.insertOne(session);
  }

  async update(id: string, values: Partial<Omit<SessionDTO, '_id'>>): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id } as Filter<SessionDTO>,
      { $set: values } as UpdateFilter<SessionDTO>,
    );
    return result.matchedCount > 0;
  }

  async renew(id: string, renewedBefore: Date, renewedAt: Date, expiresAt: Date): Promise<boolean> {
    const result = await this.collection.updateOne(
      {
        _id: id,
        renewedAt: { $lte: renewedBefore },
        expiresAt: { $gt: renewedAt },
      } as Filter<SessionDTO>,
      { $set: { renewedAt, expiresAt } } as UpdateFilter<SessionDTO>,
    );
    return result.modifiedCount > 0;
  }
}
