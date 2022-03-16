import { Closable } from 'common/@types';
import { logger } from 'common/logger';
import {
  httpRequest,
  HttpRequestError,
  querystringify,
  RequestOptions,
  RequestParams,
} from 'common/request';
import { promiseTimeout } from 'common/util';
import { randomUUID } from 'crypto';
import { InMemoryCache } from 'data';
import { EolianCache } from 'data/@types';
import { Readable } from 'stream';
import {
  TokenResponse,
  AuthorizationProvider,
  TokenResponseWithRefresh,
  AuthService,
  AuthResult,
  AuthCallbackData,
  TokenProvider,
  OAuthRequest,
  TrackSource,
} from './@types';

export class ClientCredentialsProvider implements TokenProvider {

  private readonly options: RequestOptions;
  private refreshToken?: string;

  constructor(
    readonly name: string,
    private readonly tokenEndpoint: string,
    authenticationOptions: RequestOptions
  ) {
    this.options = { ...authenticationOptions, method: 'POST', json: true };
  }

  async getToken(): Promise<TokenResponse> {
    if (this.refreshToken) {
      try {
        const form: RequestOptions['form'] = {
          ...this.options.form,
          grant_type: 'refresh_token',
          refresh_token: this.refreshToken,
        };
        return await this.request({ ...this.options, form });
      } catch (e: any) {
        if (!(e instanceof HttpRequestError) || e.body.error !== 'invalid_grant') {
          throw e;
        }
      }
    }

    const form: RequestOptions['form'] = { ...this.options.form, grant_type: 'client_credentials' };
    return await this.request({ ...this.options, form });
  }

  private async request(options: RequestOptions): Promise<TokenResponse> {
    logger.info(`%s HTTP: %s`, this.name, this.tokenEndpoint);
    const result: TokenResponse = await httpRequest(this.tokenEndpoint, options);
    if (result.refresh_token) {
      this.refreshToken = result.refresh_token;
    }
    return result;
  }

}

export class AuthorizationCodeProvider implements TokenProvider {

  private readonly options: RequestOptions;

  constructor(
    readonly name: string,
    private readonly tokenEndpoint: string,
    authenticationOptions: RequestOptions,
    readonly authorization: AuthorizationProvider,
    private refreshToken?: string
  ) {
    this.options = { ...authenticationOptions, method: 'POST', json: true };
    this.options.form = { ...this.options.form, grant_type: 'refresh_token' };
  }

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
    logger.info(`%s HTTP: %s`, this.name, this.tokenEndpoint);
    this.options.form!.refresh_token = token;
    const result: TokenResponse = await httpRequest(this.tokenEndpoint, this.options);
    if (result.refresh_token) {
      this.refreshToken = result.refresh_token;
    }
    return result;
  }

}

export class OAuthRequestImpl<T extends TokenProvider> implements OAuthRequest<T> {

  private expiration = 0;
  private accessToken?: string;

  constructor(readonly baseApiUrl: string, readonly tokenProvider: T) {}

  get<T>(path: string, params = {}): Promise<T> {
    return this.checkGetRequest(`${this.baseApiUrl}/${path}`, params);
  }

  getUri<T>(uri: string): Promise<T> {
    return this.checkGetRequest(uri);
  }

  getStream(uri: string): Promise<Readable> {
    return this.checkGetRequest<Readable>(uri, undefined, true);
  }

  private async checkGetRequest<T>(
    url: string,
    params?: RequestParams,
    stream = false
  ): Promise<T> {
    if (Date.now() + 10000 >= this.expiration) {
      await this.updateToken();
    }
    try {
      return await this.getRequest<T>(url, params, stream);
    } catch (e) {
      if (!(e instanceof HttpRequestError) || e.body.error !== 'invalid_grant') {
        throw e;
      }
      await this.updateToken();
      return await this.getRequest<T>(url, params, stream);
    }
  }

  private async getRequest<T>(url: string, params?: RequestParams, stream = false) {
    logger.info(`%s HTTP: %s - %s`, this.tokenProvider.name, url, params);
    return await httpRequest<T>(url, { params, json: !stream, auth: { bearer: this.accessToken } });
  }

  private async updateToken() {
    const data = await this.tokenProvider.getToken();
    this.accessToken = data.access_token;
    this.expiration = Date.now() + data.expires_in * 1000;
  }

}

export type AuthCacheItem = {
  resolve: (resp: TokenResponseWithRefresh) => void;
  reject: (err?: any) => void;
};

export type AuthorizeParams = {
  client_id: string;
  redirect_uri: string;
  scope?: string;
};

export class AuthServiceImpl implements AuthService {

  private options: RequestOptions;

  constructor(
    private readonly name: string,
    private readonly authorizeUrl: string,
    private readonly tokenUrl: string,
    private readonly authorizeParams: AuthorizeParams,
    authenticationOptions: RequestOptions,
    private readonly cache: EolianCache<AuthCacheItem>
  ) {
    this.options = { ...authenticationOptions, method: 'POST', json: true };
    this.options.form = {
      ...this.options.form,
      grant_type: 'authorization_code',
      redirect_uri: this.authorizeParams.redirect_uri,
    };
  }

  authorize(): AuthResult {
    const state = randomUUID();
    const params = { ...this.authorizeParams, response_type: 'code', state };
    const link = `${this.authorizeUrl}?${querystringify(params)}`;
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

  private async getToken(code: string): Promise<TokenResponseWithRefresh> {
    logger.info(`%s HTTP: %s`, this.name, this.tokenUrl);
    this.options.form!.code = code;
    return await httpRequest(this.tokenUrl, this.options);
  }

}

const AUTH_PROVIDER_CACHE_TTL = 1000 * 60 * 75;

type UserRequest = OAuthRequest<AuthorizationCodeProvider>;

export class AuthProviders implements Closable {

  private readonly requestCache: EolianCache<UserRequest> = new InMemoryCache(
    AUTH_PROVIDER_CACHE_TTL,
    false
  );

  constructor(
    private readonly authCallbackCache: EolianCache<AuthCacheItem>,
    private readonly spotify: AuthService
  ) {}

  getService(api: TrackSource): AuthService {
    switch (api) {
      case TrackSource.Spotify:
        return this.spotify;
      default:
        throw new Error(`Auth service not supported for: ${api}`);
    }
  }

  async getUserRequest(userId: string, api: TrackSource): Promise<UserRequest | undefined> {
    const key = `${api}_${userId}`;
    const req = await this.requestCache.get(key);
    await this.requestCache.refreshTTL(key);
    return req;
  }

  async setUserRequest(userId: string, request: UserRequest, api: TrackSource): Promise<void> {
    const key = `${api}_${userId}`;
    await this.requestCache.set(key, request);
  }

  async removeUserRequest(userId: string, api?: TrackSource): Promise<void> {
    if (api !== undefined) {
      const key = `${api}_${userId}`;
      await this.requestCache.del(key);
    } else {
      await this.removeUserRequest(userId, TrackSource.Spotify);
    }
  }

  async close(): Promise<void> {
    await Promise.allSettled([this.authCallbackCache.close(), this.requestCache.close()]);
  }

}
