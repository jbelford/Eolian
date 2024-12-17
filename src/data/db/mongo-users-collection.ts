import { SyntaxType } from '@eolian/command-options/@types';
import { UserDTO, UsersDb, Identifier } from '../@types';
import { MongoCollection } from './mongo-collection';

export class MongoUsers extends MongoCollection<UserDTO> implements UsersDb {
  async setSoundCloud(id: string, soundcloud: number): Promise<void> {
    await this.setProperty(id, 'soundcloud', soundcloud);
  }

  async removeSoundCloud(id: string): Promise<void> {
    await this.unsetProperty(id, 'soundcloud');
  }

  async setSoundCloudRefreshToken(id: string, token: string): Promise<void> {
    await this.setProperty(id, 'tokens.soundcloud', token);
  }

  async removeSoundCloudRefreshToken(id: string): Promise<void> {
    await this.unsetProperty(id, 'tokens.soundcloud');
  }

  async setSpotify(id: string, spotify: string): Promise<void> {
    await this.setProperty(id, 'spotify', spotify);
  }

  async setSpotifyRefreshToken(id: string, token: string): Promise<void> {
    await this.setProperty(id, `tokens.spotify`, token);
  }

  async removeSpotify(id: string): Promise<void> {
    await this.unsetProperty(id, 'spotify');
  }

  async removeSpotifyRefreshToken(id: string): Promise<void> {
    await this.unsetProperty(id, 'tokens.spotify');
  }

  async setIdentifier(id: string, key: string, identifier: Identifier): Promise<void> {
    await this.setProperty(id, `identifiers.${key}`, identifier);
  }

  async removeIdentifier(id: string, key: string): Promise<boolean> {
    return await this.unsetProperty(id, `identifiers.${key}`);
  }

  async setSyntax(id: string, type: SyntaxType): Promise<void> {
    await this.setProperty(id, 'syntax', type);
  }

  async removeSyntax(id: string): Promise<void> {
    await this.unsetProperty(id, 'syntax');
  }
}
