import { EolianBotError } from "../common/errors";

export class EolianUserService {

  constructor(private readonly users: UsersDAO) { }

  async linkSpotifyAccount(userId: string, spotifyId: string): Promise<EolianBotError> {
    try {
      await this.users.setSpotify(userId, spotifyId);
    } catch (e) {
      return new EolianBotError(e.stack ? e.stack : e, 'Something went wrong. Failed to link Spotify.');
    }
  }

}