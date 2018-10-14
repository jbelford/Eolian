import * as SpotifyWebApi from 'spotify-web-api-node';
import { EolianBotError } from '../common/errors';
import { logger } from '../common/logger';
import environment from '../environments/env';

export namespace Spotify {

  const spotify = new SpotifyWebApi({
    clientId: environment.tokens.spotify.clientId,
    clientSecret: environment.tokens.spotify.clientSecret
  });
  let expiration = 0;

  export async function getUser(userUri: string): Promise<[SpotifyUser, EolianBotError]> {
    const matcher = /(spotify\.com\/user\/|spotify:user:)([^\?]+)/g
    const regArr = matcher.exec(userUri);
    if (!regArr) return [null, new EolianBotError('Spotify URI is malformatted.')];

    const userId = regArr[2];
    logger.debug(`Getting user: ${userId}`);
    try {
      await checkAndUpdateToken();
      const response = await spotify.getUser(userId);
      const user = <SpotifyUser>response.body;
      return [user, null];
    } catch (e) {
      return [null, new EolianBotError(e.stack ? e.stack : e, 'Failed to fetch Spotify user.')];
    }
  }

  async function checkAndUpdateToken() {
    if (Date.now() + 1000 > expiration) {
      const data = await spotify.clientCredentialsGrant();
      expiration = Date.now() + data.body.expires_in;
      spotify.setAccessToken(data.body.access_token);
    }
  }


}