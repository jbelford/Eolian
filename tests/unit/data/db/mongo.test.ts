import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyntaxType } from '@eolian/command-options/@types';
import { TrackSource } from '@eolian/api/@types';
import { ResourceType } from '@eolian/data/@types';

const { connect, close, collection, db, MongoClient } = vi.hoisted(() => {
  const connect = vi.fn();
  const close = vi.fn();
  const collection = vi.fn((name: string) => ({ name }));
  const db = vi.fn(() => ({ collection }));
  const MongoClient = vi.fn(function () {
    return { connect, close, db };
  });
  return { connect, close, collection, db, MongoClient };
});

vi.mock('mongodb', () => ({ MongoClient }));

import { MongoCollection } from '@eolian/data/db/mongo-collection';
import { MongoServers } from '@eolian/data/db/mongo-servers-collection';
import { MongoUsers } from '@eolian/data/db/mongo-users-collection';
import { createDatabase } from '@eolian/data/db/mongo-database';

function mockCollection() {
  return {
    findOne: vi.fn(),
    deleteOne: vi.fn(),
    updateOne: vi.fn(),
    find: vi.fn(),
  };
}

describe('Mongo collections', () => {
  it('maps get and delete operations to _id filters', async () => {
    const collection = mockCollection();
    collection.findOne.mockResolvedValue({ _id: 'user' });
    collection.deleteOne.mockResolvedValue({ deletedCount: 1 });
    const wrapper = new MongoCollection(collection as never);

    await expect(wrapper.get('user')).resolves.toEqual({ _id: 'user' });
    await expect(wrapper.delete('user')).resolves.toBe(true);
    expect(collection.findOne).toHaveBeenCalledWith({ _id: 'user' });
    expect(collection.deleteOne).toHaveBeenCalledWith({ _id: 'user' });
  });

  it('uses upserted dotted updates for user properties', async () => {
    const collection = mockCollection();
    collection.updateOne.mockResolvedValue({ modifiedCount: 1 });
    const users = new MongoUsers(collection as never);
    const identifier = {
      id: 'track',
      url: 'url',
      src: TrackSource.Spotify,
      type: ResourceType.Song,
    };

    await users.setSpotifyRefreshToken('user', 'refresh');
    await users.setIdentifier('user', 'favorite', identifier);
    await expect(users.removeIdentifier('user', 'favorite')).resolves.toBe(true);

    expect(collection.updateOne.mock.calls).toEqual([
      [
        { _id: 'user' },
        { $set: { 'tokens.spotify': 'refresh' }, $setOnInsert: { _id: 'user' } },
        { upsert: true },
      ],
      [
        { _id: 'user' },
        { $set: { 'identifiers.favorite': identifier }, $setOnInsert: { _id: 'user' } },
        { upsert: true },
      ],
      [{ _id: 'user' }, { $unset: { 'identifiers.favorite': true } }],
    ]);
  });

  it('maps server queries and updates without transforming values', async () => {
    const collection = mockCollection();
    const cursor = { toArray: vi.fn().mockResolvedValue([{ _id: 'idle' }]) };
    collection.find.mockReturnValue(cursor);
    collection.updateOne.mockResolvedValue({ modifiedCount: 0 });
    const servers = new MongoServers(collection as never);
    const cutoff = new Date('2024-01-01T00:00:00Z');

    await expect(servers.getIdleServers(cutoff)).resolves.toEqual([{ _id: 'idle' }]);
    expect(collection.find).toHaveBeenCalledWith({
      $or: [{ lastUsage: { $exists: false } }, { lastUsage: { $lte: cutoff } }],
    });

    await servers.setLastUsage('guild', cutoff, 'channel');
    await servers.setSyntax('guild', SyntaxType.SLASH);
    await servers.addDjRole('guild', 'role');
    await expect(servers.removeDjRole('guild', 'role')).resolves.toBe(false);
    await servers.updateSettings('guild', {
      prefix: '?',
      volume: 0.5,
      preferredChannelId: null,
      djRoleIds: ['role'],
    });

    expect(collection.updateOne.mock.calls[0]).toEqual([
      { _id: 'guild' },
      { $set: { lastUsage: cutoff, lastChannelId: 'channel' }, $setOnInsert: { _id: 'guild' } },
      { upsert: true },
    ]);
    expect(collection.updateOne.mock.calls[2]).toEqual([
      { _id: 'guild' },
      { $addToSet: { djRoleIds: 'role' }, $setOnInsert: { _id: 'guild' } },
      { upsert: true },
    ]);
    expect(collection.updateOne.mock.calls[3]).toEqual([
      { _id: 'guild' },
      { $pull: { djRoleIds: 'role' } },
    ]);
    expect(collection.updateOne.mock.calls[4]).toEqual([
      { _id: 'guild' },
      {
        $set: { prefix: '?', volume: 0.5, djRoleIds: ['role'] },
        $unset: { preferredChannelId: true },
        $setOnInsert: { _id: 'guild' },
      },
      { upsert: true },
    ]);
  });
});

describe('createDatabase', () => {
  beforeEach(() => {
    connect.mockReset();
    close.mockReset();
    close.mockResolvedValue(undefined);
    collection.mockClear();
    db.mockClear();
    MongoClient.mockClear();
  });

  it('connects, maps named collections, and closes the client', async () => {
    connect.mockResolvedValue(undefined);
    const database = await createDatabase();
    expect(MongoClient).toHaveBeenCalledWith('mongodb://localhost/test');
    expect(collection.mock.calls.map(args => args[0])).toEqual(['users', 'servers']);
    await database.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it('logs and exits without constructing collection wrappers after connection failure', async () => {
    const failure = new Error('offline');
    connect.mockRejectedValue(failure);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit:1');
    }) as never);

    await expect(createDatabase()).rejects.toThrow('exit:1');
    expect(exit).toHaveBeenCalledWith(1);
    expect(db).not.toHaveBeenCalled();
  });
});
