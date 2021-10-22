import { SyntaxType } from 'commands/@types';
import { Collection } from 'mongodb';
import { CollectionDb, Identifier, ServerDTO, ServersDb, UserDTO, UsersDb } from './@types';

interface MongoDoc {
  _id: string;
}

export class MongoCollection<T extends MongoDoc> implements CollectionDb<T> {

  constructor(protected readonly collection: Collection<T>) {
  }

  async get(id: string): Promise<T | null> {
    // @ts-ignore Typescript is stupid
    return await this.collection.findOne({ _id: id });
  }

  async delete(id: string): Promise<boolean> {
    // @ts-ignore Typescript is stupid
    const result = await this.collection.deleteOne({ _id: id });
    return !!result.deletedCount;
  }

  protected async setProperty<T>(id: string, key: string, value: T): Promise<void> {
    const set: any = {};
    set[key] = value;
    await this.collection.updateOne(
      // @ts-ignore
      { _id: id },
      { $set: set, $setOnInsert: { _id: id } },
      { upsert: true });
  }

  protected async unsetProperty(id: string, key: string): Promise<boolean> {
    const unset: any = {};
    unset[key] = true;
    const result = await this.collection.updateOne(
      // @ts-ignore
      { _id: id },
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

  async setLastUsage(id: string, usageUTC: string): Promise<void> {
    await this.setProperty(id, 'lastUsageUTC', usageUTC);
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

}

