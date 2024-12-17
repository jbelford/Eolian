import { Collection, Filter, UpdateFilter } from 'mongodb';
import { CollectionDb } from '../@types';

interface MongoDoc {
  _id: string;
}

export class MongoCollection<T extends MongoDoc> implements CollectionDb<T> {
  constructor(protected readonly collection: Collection<T>) {}

  async get(id: string): Promise<T | null> {
    return (await this.collection.findOne({ _id: id } as unknown as Filter<T>)) as T | null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id } as unknown as Filter<T>);
    return !!result.deletedCount;
  }

  protected async setProperty<K extends Extract<keyof T, string>, V>(
    id: string,
    key: K | `${K}.${string}`,
    value: V,
  ): Promise<void> {
    await this.collection.updateOne(
      { _id: id } as unknown as Filter<T>,
      { $set: { [key]: value }, $setOnInsert: { _id: id } } as unknown as UpdateFilter<T>,
      { upsert: true },
    );
  }

  protected async unsetProperty<K extends Extract<keyof T, string>>(
    id: string,
    key: K | `${K}.${string}`,
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id } as unknown as Filter<T>,
      {
        $unset: {
          [key]: true,
        },
      } as UpdateFilter<T>,
    );
    return result.modifiedCount > 0;
  }
}
