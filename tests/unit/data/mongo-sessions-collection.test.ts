import { SessionDTO } from '@eolian/data/@types';
import { MongoSessions } from '@eolian/data/db/mongo-sessions-collection';
import { Collection } from 'mongodb';
import { describe, expect, it, vi } from 'vitest';

describe('MongoSessions', () => {
  it('creates the seven-day last-modified TTL index idempotently', async () => {
    const createIndex = vi.fn().mockResolvedValue('sessions_last_modified_ttl');
    const collection = { createIndex } as unknown as Collection<SessionDTO>;
    const sessions = new MongoSessions(collection);

    await sessions.initialize();
    await sessions.initialize();

    expect(createIndex).toHaveBeenCalledTimes(2);
    expect(createIndex.mock.calls).toEqual([
      [{ _ts: 1 }, { name: 'sessions_last_modified_ttl', expireAfterSeconds: 604800 }],
      [{ _ts: 1 }, { name: 'sessions_last_modified_ttl', expireAfterSeconds: 604800 }],
    ]);
  });

  it('propagates index creation failures without dropping an index or collection', async () => {
    const error = new Error('index creation failed');
    const createIndex = vi.fn().mockRejectedValue(error);
    const collection = { createIndex, dropIndex: vi.fn(), drop: vi.fn() };
    const sessions = new MongoSessions(collection as unknown as Collection<SessionDTO>);

    await expect(sessions.initialize()).rejects.toBe(error);
    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.drop).not.toHaveBeenCalled();
  });
});
