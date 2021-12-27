import { SyntaxType } from 'commands/@types';
import { Collection, Filter, UpdateFilter } from 'mongodb';
import { CollectionDb, Identifier, ServerDTO, ServersDb, UserDTO, UsersDb } from './@types';

interface MongoDoc {
  _id: string;
}

export class MongoCollection<T extends MongoDoc> implements CollectionDb<T> {

  constructor(protected readonly collection: Collection<T>) {
  }

  async get(id: string): Promise<T | null> {
    return await this.collection.findOne({ _id: id } as Filter<T>);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id } as Filter<T>);
    return !!result.deletedCount;
  }

  protected async setProperty<K extends Extract<keyof T, string>, V>(id: string, key: K | `${K}.${string}`, value: V): Promise<void> {
    const set: any = {};
    set[key] = value;
    await this.collection.updateOne(
      { _id: id } as Filter<T>,
      { $set: set, $setOnInsert: { _id: id } } as UpdateFilter<T>,
      { upsert: true });
  }

  protected async unsetProperty(id: string, key: string): Promise<boolean> {
    const unset: any = {};
    unset[key] = true;
    const result = await this.collection.updateOne(
      { _id: id } as Filter<T>,
      { $unset: unset });
    return result.modifiedCount > 0;
  }

}


export class MongoUsers extends MongoCollection<UserDTO> implements UsersDb {

  async setSoundCloud(id: string, soundcloud: number): Promise<void> {
    await this.setProperty(id, 'soundcloud', soundcloud);
  }

  async removeSoundCloud(id: string): Promise<void> {
    await this.unsetProperty(id, 'soundcloud');
  }

  async setSpotify(id: string, spotify: string): Promise<void> {
    await this.setProperty(id, 'spotify', spotify);
  }

  async removeSpotify(id: string): Promise<void> {
    await this.unsetProperty(id, 'spotify');
  }

  async setIdentifier(id: string, key: string, identifier: Identifier): Promise<void> {
    await this.setProperty(id, `identifiers.${key}`, identifier);
  }

  async removeIdentifier(id: string, key: string): Promise<boolean> {
    return await this.unsetProperty(id, `identifiers.${key}`);
  }

}

export class MongoServers extends MongoCollection<ServerDTO> implements ServersDb {

  async getIdleServers(minDate: Date): Promise<ServerDTO[]> {
    const result = await this.collection.find({ $or: [
        {
          lastUsage: {
            $exists: false
          }
        },
        {
          lastUsage: {
            $lte: minDate
          }
        }
      ]}).toArray();
    return result;
  }

  async setLastUsage(id: string, usageDate: Date): Promise<void> {
    await this.setProperty(id, 'lastUsage', usageDate);
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
    await this.collection.updateOne({
        _id: id
      }, {
        $addToSet: {
          djRoleIds: roleId
        },
        $setOnInsert: {
          _id: id
        }
      }, {
        upsert: true
    });
  }

  async removeDjRole(id: string, roleId: string): Promise<boolean> {
    const result = await this.collection.updateOne({
      _id: id,
    }, {
      $pull: {
        djRoleIds: roleId
      }
    });
    return result.modifiedCount > 0;
  }

  async setDjAllowLimited(id: string, allow: boolean): Promise<void> {
    await this.setProperty(id, 'djAllowLimited', allow);
  }

}

