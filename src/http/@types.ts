import { Readable } from 'stream';

export type HttpRequestStreamError = Error & { code?: string };

export type HttpRequestParams = Record<string, string | number | boolean>;

export type HttpRequestOptions = {
  method?: 'GET' | 'POST';
  params?: HttpRequestParams;
  form?: HttpRequestParams;
  headers?: Record<string, string>;
  auth?: {
    bearer?: string;
    basic?: {
      id: string;
      password: string;
    };
  };
  json?: boolean;
  proxy?: string;
};

export type TokenResponse = {
  access_token: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

export type TokenResponseWithRefresh = Required<TokenResponse>;

export interface TokenProvider {
  name: string;
  getToken(): Promise<TokenResponse>;
}

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

export type AuthCacheItem = {
  resolve: (resp: TokenResponseWithRefresh) => void;
  reject: (err?: any) => void;
};

export type AuthorizeParams = {
  client_id: string;
  redirect_uri: string;
  scope?: string;
};

export type AuthCallbackData = {
  err?: string;
  code?: string;
  state: string;
};

export interface IAuthService {
  authorize(): AuthResult;
  callback(data: AuthCallbackData): Promise<boolean>;
}

/**
 * Needs to be implemented by user
 */
export interface IAuthorizationProvider {
  authorize(): Promise<TokenResponseWithRefresh>;
}

export interface IOAuthHttpClient<T extends TokenProvider = TokenProvider> {
  readonly tokenProvider: T;
  get<T>(path: string, params?: HttpRequestParams): Promise<T>;
  getUri<T>(uri: string): Promise<T>;
  getStream(uri: string): Promise<Readable>;
}
