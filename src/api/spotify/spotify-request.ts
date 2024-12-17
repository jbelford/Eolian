import { environment } from '@eolian/common/env';
import { EolianCache } from '@eolian/data/@types';
import {
  ClientCredentialsProvider,
  AuthorizationCodeProvider,
  OAuthHttpClient,
  AuthService,
} from '@eolian/http';
import {
  IAuthorizationProvider,
  TokenProvider,
  IOAuthHttpClient,
  IAuthService,
  HttpRequestOptions,
  AuthCacheItem,
  AuthorizeParams,
} from '@eolian/http/@types';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN = 'https://accounts.spotify.com/api/token';
const SPOTIFY_AUTHORIZE = 'https://accounts.spotify.com/authorize';
const SPOTIFY_REDIRECT_URI = `${environment.baseUri}/callback/spotify`;

const SPOTIFY_AUTH_OPTIONS: HttpRequestOptions = {
  auth: {
    basic: {
      id: environment.tokens.spotify.clientId,
      password: environment.tokens.spotify.clientSecret,
    },
  },
};

export const CLIENT_SPOTIFY_REQUEST = createSpotifyRequest(
  new ClientCredentialsProvider('Spotify', SPOTIFY_TOKEN, SPOTIFY_AUTH_OPTIONS),
);

export function createSpotifyAuthorizationCodeProvider(
  provider: IAuthorizationProvider,
  refreshToken?: string,
): AuthorizationCodeProvider {
  return new AuthorizationCodeProvider(
    'Spotify',
    SPOTIFY_TOKEN,
    SPOTIFY_AUTH_OPTIONS,
    provider,
    refreshToken,
  );
}

export function createSpotifyRequest<T extends TokenProvider>(
  tokenProvider: T,
): IOAuthHttpClient<T> {
  return new OAuthHttpClient<T>(SPOTIFY_API, tokenProvider);
}

export function createSpotifyAuthService(cache: EolianCache<AuthCacheItem>): IAuthService {
  const scope = [
    'user-library-read',
    'user-top-read',
    'user-read-recently-played',
    'playlist-read-collaborative',
    'playlist-read-private',
  ].join(',');

  const authParams: AuthorizeParams = {
    client_id: environment.tokens.spotify.clientId,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope,
  };

  return new AuthService(
    'Spotify',
    SPOTIFY_AUTHORIZE,
    SPOTIFY_TOKEN,
    authParams,
    SPOTIFY_AUTH_OPTIONS,
    cache,
  );
}
