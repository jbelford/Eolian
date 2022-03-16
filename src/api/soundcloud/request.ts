import { AuthorizationProvider, AuthService, OAuthRequest, TokenProvider } from 'api/@types';
import {
  ClientCredentialsProvider,
  OAuthRequestImpl,
  AuthorizationCodeProvider,
  AuthCacheItem,
  AuthServiceImpl,
  AuthorizeParams,
} from 'api/auth';
import { environment } from 'common/env';
import { RequestOptions } from 'common/request';
import { EolianCache } from 'data/@types';

const SOUNDCLOUD_API = 'https://api.soundcloud.com';
const SOUNDCLOUD_TOKEN = `${SOUNDCLOUD_API}/oauth2/token`;
const SOUNDCLOUD_AUTHORIZE = `${SOUNDCLOUD_API}/connect`;
const SOUNDCLOUD_REDIRECT_URI = `${environment.baseUri}/callback/soundcloud`;

const SOUNDCLOUD_AUTH_OPTIONS: RequestOptions = {
  form: {
    client_id: environment.tokens.soundcloud.clientId,
    client_secret: environment.tokens.soundcloud.clientSecret,
  },
};

const clientCredentials = new ClientCredentialsProvider(
  'SoundCloud',
  SOUNDCLOUD_TOKEN,
  SOUNDCLOUD_AUTH_OPTIONS
);

export const CLIENT_SOUNDCLOUD_REQUEST = new OAuthRequestImpl(SOUNDCLOUD_API, clientCredentials);

export function createSoundCloudRequest<T extends TokenProvider>(
  tokenProvider: T
): OAuthRequest<T> {
  return new OAuthRequestImpl<T>(SOUNDCLOUD_API, tokenProvider);
}

export function createSoundCloudAuthorizationCodeProvider(
  provider: AuthorizationProvider,
  refreshToken?: string
): AuthorizationCodeProvider {
  return new AuthorizationCodeProvider(
    'SoundCloud',
    SOUNDCLOUD_TOKEN,
    SOUNDCLOUD_AUTH_OPTIONS,
    provider,
    refreshToken
  );
}

export function createSoundCloudAuthService(cache: EolianCache<AuthCacheItem>): AuthService {
  const authParams: AuthorizeParams = {
    client_id: environment.tokens.soundcloud.clientId,
    redirect_uri: SOUNDCLOUD_REDIRECT_URI,
  };

  return new AuthServiceImpl(
    'SoundCloud',
    SOUNDCLOUD_AUTHORIZE,
    SOUNDCLOUD_TOKEN,
    authParams,
    SOUNDCLOUD_AUTH_OPTIONS,
    cache
  );
}
