import { SessionDTO } from '@eolian/data/@types';
import { MongoSessions } from '@eolian/data/db/mongo-sessions-collection';
import { Collection } from 'mongodb';
import { describe, expect, it, vi } from 'vitest';

describe('MongoSessions', () => {
  it('creates the absolute-expiry TTL index idempotently', async () => {
    const createIndex = vi.fn().mockResolvedValue('sessions_expires_at_ttl');
    const collection = { createIndex } as unknown as Collection<SessionDTO>;
    const sessions = new MongoSessions(collection);

    await sessions.initialize();
    await sessions.initialize();

    expect(createIndex).toHaveBeenCalledTimes(2);
    expect(createIndex).toHaveBeenCalledWith(
      { expiresAt: 1 },
      { name: 'sessions_expires_at_ttl', expireAfterSeconds: 0 },
    );
  });
});
