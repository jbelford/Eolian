import { Closable } from 'common/@types';
import { environment } from 'common/env';
import { logger } from 'common/logger';
import { httpRequest, HttpRequestError, querystringify } from 'common/request';
import { promiseTimeout } from 'common/util';
import { randomUUID } from 'crypto';
import { InMemoryCache } from 'data';
import { EolianCache } from 'data/@types';
import {
  TokenResponse,
  AuthorizationProvider,
  TokenResponseWithRefresh,
  AuthService,
  AuthResult,
  AuthCallbackData,
  TokenProvider,
} from './@types';

const enum SPOTIFY_API_VERSIONS {
  V1 = 'v1',
}
const SPOTIFY_API = 'https://api.spotify.com';
const SPOTIFY_TOKEN = 'https://accounts.spotify.com/api/token';
const SPOTIFY_AUTHORIZE = 'https://accounts.spotify.com/authorize';

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

export class AuthorizationCodeProvider implements TokenProvider {

  constructor(
    private readonly authorization: AuthorizationProvider,
    private refreshToken?: string
  ) {}

  async getToken(): Promise<TokenResponse> {
    if (this.refreshToken) {
      try {
        return await this.refresh(this.refreshToken);
      } catch (e: any) {
        if (!(e instanceof HttpRequestError) || e.body.error !== 'invalid_grant') {
          throw e;
        }
      }
    }
    const resp = await this.authorization.authorize();
    this.refreshToken = resp.refresh_token;
    return resp;
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
    if (Date.now() + 10000 >= this.expiration) {
      await this.updateToken();
    }
    try {
      return await this.getRequest<T>(url, params);
    } catch (e) {
      if (!(e instanceof HttpRequestError) || e.body.error !== 'invalid_grant') {
        throw e;
      }
      await this.updateToken();
      return await this.getRequest<T>(url, params);
    }
  }

  private async getRequest<T>(url: string, params = {}) {
    logger.info(`Spotify HTTP: %s - %s`, url, params);
    return await httpRequest<T>(url, { params, json: true, auth: { bearer: this.accessToken } });
  }

  private async updateToken() {
    const data = await this.tokenProvider.getToken();
    this.accessToken = data.access_token;
    this.expiration = Date.now() + data.expires_in * 1000;
  }

}

const SPOTIFY_SCOPES = [
  'user-library-read',
  'user-top-read',
  'user-read-recently-played',
  'playlist-read-collaborative',
  'playlist-read-private',
].join(',');

type SpotifyAuthCacheItem = {
  resolve: (resp: TokenResponseWithRefresh) => void;
  reject: (err?: any) => void;
};

const SPOTIFY_REDIRECT_URI = `${environment.baseUri}:${environment.port}/callback/spotify`;

export class SpotifyAuth implements AuthService {

  private cache: EolianCache<SpotifyAuthCacheItem> = new InMemoryCache(60, false);

  authorize(): AuthResult {
    const state = randomUUID();
    const params = {
      response_type: 'code',
      client_id: environment.tokens.spotify.clientId,
      scope: SPOTIFY_SCOPES,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      state,
    };
    const link = `${SPOTIFY_AUTHORIZE}?` + querystringify(params);
    const promise = new Promise<TokenResponseWithRefresh>((resolve, reject) => {
      this.cache.set(state, { resolve, reject });
    });
    return { link, response: promiseTimeout(promise, 60000) };
  }

  async callback(data: AuthCallbackData): Promise<boolean> {
    let success = false;
    const item = await this.cache.get(data.state);
    if (item) {
      if (data.err) {
        item.reject(data.err);
      } else if (data.code) {
        const resp = await this.getToken(data.code);
        item.resolve(resp);
        success = true;
      } else {
        item.reject('Missing authorization code!');
      }
      await this.cache.del(data.state);
    }
    return success;
  }

  async close(): Promise<void> {
    await this.cache.close();
  }

  private async getToken(code: string): Promise<TokenResponseWithRefresh> {
    logger.info(`Spotify HTTP: %s`, SPOTIFY_TOKEN);
    return await httpRequest(SPOTIFY_TOKEN, {
      method: 'POST',
      form: { grant_type: 'authorization_code', code, redirect_uri: SPOTIFY_REDIRECT_URI },
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

export class AuthProviders implements Closable {

  readonly spotify: AuthService = new SpotifyAuth();

  async close(): Promise<void> {
    await Promise.allSettled([this.spotify.close()]);
  }

}
