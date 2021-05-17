import { logger } from 'common/logger';
import { Identifier, UserDTO, UsersDAO } from 'data/@types';

export class EolianUserService {

  constructor(private readonly users: UsersDAO) { }

  async linkSpotifyAccount(userId: string, spotifyId: string): Promise<void> {
    try {
      await this.users.setSpotify(userId, spotifyId);
    } catch (e) {
      logger.warn(`Failed to link Spotify: userId: ${userId} spotifyId: ${spotifyId}`);
      throw e;
    }
  }

  async linkSoundCloudAccount(userId: string, scId: number): Promise<void> {
    try {
      await this.users.setSoundCloud(userId, scId);
    } catch (e) {
      logger.warn(`Failed to link SoundCloud: userId: ${userId} scId: ${scId}`);
      throw e;
    }
  }

  async unlinkSpotifyAccount(userId: string): Promise<void> {
    try {
      await this.users.removeSpotify(userId);
    } catch (e) {
      logger.warn(`Failed to unlink Spotify: userId: ${userId}`);
      throw e;
    }
  }

  async unlinkSoundCloudAccount(userId: string): Promise<void> {
    try {
      await this.users.removeSoundCloud(userId);
    } catch (e) {
      logger.warn(`Failed to unlink SoundCloud: userId: ${userId}`);
      throw e;
    }
  }

  async addResourceIdentifier(userId: string, key: string, identifier: Identifier): Promise<void> {
    try {
      await this.users.setIdentifier(userId, key, identifier);
    } catch (e) {
      logger.warn(`Failed to add identifier: userId: ${userId} key: ${key} identifier: ${JSON.stringify(identifier)}`);
      throw e;
    }
  }

  async removeResourceIdentifier(userId: string, key: string): Promise<boolean> {
    try {
      return await this.users.removeIdentifier(userId, key);
    } catch (e) {
      logger.warn(`Failed to add identifier: userId: ${userId} key: ${key}`);
      throw e;
    }
  }

  async getUser(userId: string): Promise<UserDTO> {
    try {
      return await this.users.get(userId);
    } catch (e) {
      logger.warn(`Failed to get user: userId: ${userId}`);
      throw e;
    }
  }

  async removeUser(userId: string): Promise<boolean> {
    try {
      return await this.users.delete(userId);
    } catch (e) {
      logger.warn(`Failed to remove user: userId: ${userId}`);
      throw e;
    }
  }

}