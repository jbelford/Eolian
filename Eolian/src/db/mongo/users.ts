import { Collection, Db } from "mongodb";

export class MongoUsers implements UsersDAO {

  private readonly users: Collection<UserDTO>;

  constructor(db: Db) {
    this.users = db.collection('users');
  }

  public async get(id: string) {
    const result = await this.users.findOneAndUpdate(
      { _id: { $eq: id } },
      { $setOnInsert: { _id: id } },
      { upsert: true }
    );
    return result.value;
  }

  public async setSoundCloud(id: string, soundcloud: number) {
    await this.users.updateOne(
      { _id: { $eq: id } },
      {
        $setOnInsert: { _id: id },
        $set: { soundcloud: soundcloud }
      },
      { upsert: true }
    );
  }

  public async removeSoundCloud(id: string) {
    await this.users.updateOne({ _id: { $eq: id } }, { $unset: { soundcloud: '' } });
  }

  public async setSpotify(id: string, spotify: string) {
    await this.users.updateOne(
      { _id: { $eq: id } },
      { $setOnInsert: { _id: id }, $set: { spotify: spotify } },
      { upsert: true }
    );
  }

  public async removeSpotify(id: string) {
    await this.users.updateOne({ _id: { $eq: id } }, { $unset: { spotify: '' } });
  }


  public async setIdentifier(id: string, key: string, identifier: Identifier) {
    const set = {};
    set[`identifiers.${key}`] = identifier;
    await this.users.updateOne(
      { _id: { $eq: id } },
      { $setOnInsert: { _id: id }, $set: set },
      { upsert: true }
    );
  }

  public async removeIdentifier(id: string, key: string) {
    const unset = {};
    unset[`identifiers.${key}`] = '';
    await this.users.updateOne({ _id: { $eq: id } }, { $unset: unset });
  }

}