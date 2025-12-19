import { SyntaxType } from '@eolian/command-options/@types';
import { ServerDTO, ServersDb } from '../@types';
import { MongoCollection } from './mongo-collection';

export class MongoServers extends MongoCollection<ServerDTO> implements ServersDb {
  async getIdleServers(minDate: Date): Promise<ServerDTO[]> {
    const result = await this.collection
      .find({
        $or: [
          {
            lastUsage: {
              $exists: false,
            },
          },
          {
            lastUsage: {
              $lte: minDate,
            },
          },
        ],
      })
      .toArray();
    return result;
  }

  async setLastUsage(id: string, usageDate: Date, channelId: string): Promise<void> {
    await this.collection.updateOne(
      { _id: id },
      { $set: { lastUsage: usageDate, lastChannelId: channelId }, $setOnInsert: { _id: id } },
      { upsert: true },
    );
  }

  async setPreferredChannel(id: string, channelId: string): Promise<void> {
    await this.setProperty(id, 'preferredChannelId', channelId);
  }

  async setPrefix(id: string, prefix: string): Promise<void> {
    await this.setProperty(id, 'prefix', prefix);
  }

  async setVolume(id: string, volume: number): Promise<void> {
    await this.setProperty(id, 'volume', volume);
  }

  async setSyntax(id: string, type: SyntaxType): Promise<void> {
    await this.setProperty(id, 'syntax', type);
  }

  async addDjRole(id: string, roleId: string): Promise<void> {
    await this.collection.updateOne(
      {
        _id: id,
      },
      {
        $addToSet: {
          djRoleIds: roleId,
        },
        $setOnInsert: {
          _id: id,
        },
      },
      {
        upsert: true,
      },
    );
  }

  async removeDjRole(id: string, roleId: string): Promise<boolean> {
    const result = await this.collection.updateOne(
      {
        _id: id,
      },
      {
        $pull: {
          djRoleIds: roleId,
        },
      },
    );
    return result.modifiedCount > 0;
  }

  async setDjAllowLimited(id: string, allow: boolean): Promise<void> {
    await this.setProperty(id, 'djAllowLimited', allow);
  }
}
