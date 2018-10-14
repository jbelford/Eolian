import { EolianBotError } from "../common/errors";

export class EolianUserService {

  constructor(private readonly users: UsersDAO) { }

  async linkSpotifyAccount(userId: string, spotifyId: string): Promise<void> {
    try {
      await this.users.setSpotify(userId, spotifyId);
    } catch (e) {
      throw new EolianBotError(e.stack ? e.stack : e, 'Something went wrong. Failed to link Spotify.');
    }
  }

  async linkSoundCloudAccount(userId: string, scId: number): Promise<void> {
    try {
      await this.users.setSoundCloud(userId, scId);
    } catch (e) {
      throw new EolianBotError(e.stack ? e.stack : e, 'Something went wrong. Failed to link SoundCloud.');
    }
  }

}