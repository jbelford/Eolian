import { EolianBotError } from "common/errors";

export class EolianUserService {

  constructor(private readonly users: UsersDAO) { }

  async linkSpotifyAccount(userId: string, spotifyId: string): Promise<void> {
    try {
      await this.users.setSpotify(userId, spotifyId);
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Something went wrong. Failed to link Spotify.');
    }
  }

  async linkSoundCloudAccount(userId: string, scId: number): Promise<void> {
    try {
      await this.users.setSoundCloud(userId, scId);
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Something went wrong. Failed to link SoundCloud.');
    }
  }

  async unlinkSpotifyAccount(userId: string) {
    try {
      await this.users.removeSpotify(userId);
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Something went wrong. Failed to unlink Spotify.');
    }
  }

  async unlinkSoundCloudAccount(userId: string) {
    try {
      await this.users.removeSoundCloud(userId);
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Something went wrong. Failed to unlink SoundCloud.');
    }
  }

  async addResourceIdentifier(userId: string, key: string, identifier: Identifier) {
    try {
      await this.users.setIdentifier(userId, key, identifier);
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Something went wrong. Failed to set the identifier.');
    }
  }

  async getUser(userId: string): Promise<UserDTO> {
    try {
      return await this.users.get(userId);
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Something went wrong. Failed to fetch user information.');
    }
  }

  async removeUser(userId: string): Promise<boolean> {
    try {
      return await this.users.delete(userId);
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Something went wrong. Failed to remove user information.');
    }
  }

}