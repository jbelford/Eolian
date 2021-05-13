import { Collection } from 'mongodb';
import { Identifier, UserDTO, UsersDAO } from './@types';

export class MongoUsers implements UsersDAO {

  constructor(private readonly collection: Collection<UserDTO>) {
  }

  async get(id: string): Promise<UserDTO> {
    const user = await this.collection.findOne({ _id: id });
    return user || { id };
  }

  async setSoundCloud(id: string, soundcloud: number): Promise<void> {
    await this.collection.updateOne(
      { _id: id },
      { $set: { soundcloud }, $setOnInsert: { _id: id, id } },
      { upsert: true });
  }

  async removeSoundCloud(id: string): Promise<void> {
    await this.collection.updateOne(
      { _id: id },
      { $unset: { soundcloud: true } });
  }

  async setSpotify(id: string, spotify: string): Promise<void> {
    await this.collection.updateOne(
      { _id: id },
      { $set: { spotify }, $setOnInsert: { _id: id, id } },
      { upsert: true });
  }

  async removeSpotify(id: string): Promise<void> {
    await this.collection.updateOne(
      { _id: id },
      { $unset: { spotify: true } });
  }

  async setIdentifier(id: string, key: string, identifier: Identifier): Promise<void> {
    const set: any = {};
    set[`identifiers.${key}`] = identifier;

    await this.collection.updateOne(
      { _id: id },
      { $set: set, $setOnInsert: { _id: id, id } },
      { upsert: true });
  }

  async removeIdentifier(id: string, key: string): Promise<boolean> {
    const unset: any = {};
    unset[`identifiers.${key}`] = true;

    const result = await this.collection.updateOne(
      { _id: id },
      { $unset: unset },
      { upsert: true });
    return result.modifiedCount > 0;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id });
    return !!result.deletedCount;
  }

}

