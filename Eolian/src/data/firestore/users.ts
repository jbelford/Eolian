import { CollectionReference, FieldValue, Firestore } from '@google-cloud/firestore';


export class FirestoreUsers implements UsersDAO {

  private readonly users: CollectionReference;

  constructor(firestore: Firestore) {
    this.users = firestore.collection('users');
  }

  async get(id: string): Promise<UserDTO | undefined> {
    const doc = await this.users.doc(id).get();
    return <UserDTO> doc.data();
  }

  async setSoundCloud(id: string, soundcloud: number): Promise<void> {
    await this.users.doc(id).set({ id, soundcloud }, { merge: true });
  }

  async removeSoundCloud(id: string): Promise<void> {
    await this.users.doc(id).update({ soundcloud: FieldValue.delete() });
  }

  async setSpotify(id: string, spotify: string): Promise<void> {
    await this.users.doc(id).set({ id, spotify }, { merge: true });
  }

  async removeSpotify(id: string): Promise<void> {
    await this.users.doc(id).update({ spotify: FieldValue.delete() });
  }

  async setIdentifier(id: string, key: string, identifier: Identifier): Promise<void> {
    const identifiers = {};
    identifiers[key] = identifier;
    await this.users.doc(id).set({ id, identifiers }, { merge: true });
  }

  async removeIdentifier(id: string, key: string): Promise<void> {
    const data = {};
    data[`identifiers.${key}`] = FieldValue.delete();
    await this.users.doc(id).update(data);
  }

  delete(id: string): Promise<boolean> {
    return this.users.doc(id).delete().then(() => true, () => false);
  }


}