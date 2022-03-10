import { Closable } from 'common/@types';
import { environment } from 'common/env';
import { logger } from 'common/logger';
import { httpRequest, querystringify } from 'common/request';
import { randomUUID } from 'crypto';
import { InMemoryCache } from 'data';
import { EolianCache } from 'data/@types';

export type TokenResponse = {
  access_token: string;
  scope: string;
  expires_in: number;
};

export type TokenResponseWithRefresh = TokenResponse & {
  refresh_token: string;
};

export type AuthResult = {
  /**
   * The link which the user should be directed to in order to provide authorization
   */
  link: string;
  /**
   * An awaitable callback which will return a token once the user has authorized
   */
  response: Promise<TokenResponseWithRefresh>;
};

export type AuthCallbackData = {
  err?: string;
  code?: string;
  state: string;
};

export interface AuthService {
  authorize(): AuthResult;
  callback(data: AuthCallbackData): void;
}

const enum SPOTIFY_API_VERSIONS {
  V1 = 'v1',
}
const SPOTIFY_API = 'https://api.spotify.com';
const SPOTIFY_TOKEN = 'https://accounts.spotify.com/api/token';
const SPOTIFY_AUTHORIZE = 'https://accounts.spotify.com/authorize';

export interface TokenProvider {
  getToken(): Promise<TokenResponse>;
}

export class ClientCredentialsProvider implements TokenProvider {

  async getToken(): Promise<TokenResponse> {
    logger.info(`Spotify HTTP: %s`, SPOTIFY_TOKEN);
    return await httpRequest(SPOTIFY_TOKEN, {
      method: 'POST',
      form: { grant_type: 'client_credentials' },
      auth: {
        basic: {
          id: environment.tokens.spotify.clientId,
          password: environment.tokens.spotify.clientSecret,
        },
      },
      json: true,
    });
  }

}

/**
 * Needs to be implemented by user
 */
export interface AuthorizationProvider {
  authorize(): Promise<TokenResponseWithRefresh>;
}

export class AuthorizationCodeProvider implements TokenProvider {

  constructor(private readonly authorization: AuthorizationProvider,
    private refreshToken?: string) {}

  async getToken(): Promise<TokenResponse> {
    if (!this.refreshToken) {
      const resp = await this.authorization.authorize();
      this.refreshToken = resp.refresh_token;
      return resp;
    } else {
      logger.info(`Spotify HTTP: %s`, SPOTIFY_TOKEN);
      return await this.refresh(this.refreshToken);
    }
  }

  private async refresh(token: string): Promise<TokenResponse> {
    logger.info(`Spotify HTTP: %s`, SPOTIFY_TOKEN);
    return await httpRequest(SPOTIFY_TOKEN, {
      method: 'POST',
      form: { grant_type: 'refresh_token', refresh_token: token },
      auth: {
        basic: {
          id: environment.tokens.spotify.clientId,
          password: environment.tokens.spotify.clientSecret,
        },
      },
      json: true,
    });
  }

}

export class SpotifyRequest {

  private expiration = 0;
  private accessToken?: string;

  constructor(private readonly tokenProvider: TokenProvider = new ClientCredentialsProvider()) {}

  get<T>(path: string, params = {}, version = SPOTIFY_API_VERSIONS.V1): Promise<T> {
    return this.getUrl(`${SPOTIFY_API}/${version}/${path}`, params);
  }

  private async getUrl<T>(url: string, params = {}): Promise<T> {
    logger.info(`Spotify HTTP: %s - %s`, url, params);
    await this.checkAndUpdateToken();
    return (await httpRequest(url, {
      params,
      json: true,
      auth: { bearer: this.accessToken },
    })) as unknown as Promise<T>;
  }

  private async checkAndUpdateToken() {
    if (Date.now() + 10000 >= this.expiration) {
      const data = await this.tokenProvider.getToken();
      this.accessToken = data.access_token;
      this.expiration = Date.now() + data.expires_in * 1000;
    }
  }

}

const SPOTIFY_SCOPES = [
  'user-library-read',
  'user-top-read',
  'user-read-recently-played',
  'playlist-read-collaborative',
  'playlist-read-private'
].join(',');

type SpotifyAuthCacheItem = {
  resolve: (resp: TokenResponseWithRefresh) => void;
  reject: (err?: any) => void;
};

const REDIRECT_URI = `https://${environment.baseUri}:${environment.port}/callback/spotify`;

export const enum SpotifyAuthErr {
  EXPIRED = 'expired'
}

export class SpotifyAuth implements AuthService, Closable {

  private cache: EolianCache<SpotifyAuthCacheItem> = new InMemoryCache(60, false, (key, value) => {
    value.reject(SpotifyAuthErr.EXPIRED);
  }, undefined, 60);

  authorize(): AuthResult {
    const state = randomUUID();
    const params = {
      response_type: 'code',
      client_id: environment.tokens.spotify.clientId,
      scope: SPOTIFY_SCOPES,
      redirect_uri: REDIRECT_URI,
      state,
    };
    const link = `${SPOTIFY_AUTHORIZE}?` + querystringify(params);
    const promise = new Promise<TokenResponseWithRefresh>((resolve, reject) => {
      this.cache.set(state, { resolve, reject });
    });
    return { link, response: promise };
  }

  async callback(data: AuthCallbackData): Promise<void> {
    const item = await this.cache.get(data.state);
    if (item) {
      await this.cache.del(data.state);
      if (data.err) {
        item.reject(data.err);
      } else if (data.code) {
        const resp = await this.getToken(data.code);
        item.resolve(resp);
      } else {
        item.reject('Missing authorization code!');
      }
    }
  }

  async close(): Promise<void> {
    await this.cache.close();
  }

  private async getToken(code: string): Promise<TokenResponseWithRefresh> {
    logger.info(`Spotify HTTP: %s`, SPOTIFY_TOKEN);
    return await httpRequest(SPOTIFY_TOKEN, {
      method: 'POST',
      form: { grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI },
      auth: {
        basic: {
          id: environment.tokens.spotify.clientId,
          password: environment.tokens.spotify.clientSecret,
        },
      },
      json: true,
    });
  }

}
