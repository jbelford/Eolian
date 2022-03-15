import { AbsRangeArgument } from 'common/@types';
import { Color } from 'common/constants';
import { RequestParams } from 'common/request';
import { Readable } from 'stream';

export interface StreamFetcher {
  getStream(track: Track): Promise<StreamSource | undefined>;
}

export type RangeFactory = (total: number) => AbsRangeArgument | undefined;

export const enum TrackSource {
  Unknown = 0,
  Spotify,
  YouTube,
  SoundCloud,
}

export type TrackSourceDetails = {
  name: string;
  color: Color;
  icon?: string;
};

export interface Track {
  readonly id?: string;
  readonly title: string;
  readonly poster: string;
  readonly url: string;
  readonly stream?: string;
  readonly artwork?: string;
  readonly src: TrackSource;
  readonly duration?: number;
  readonly live?: boolean;
}

export interface StreamSource {
  get(seek?: number): Promise<Readable>;
}

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

export type AuthCallbackData = {
  err?: string;
  code?: string;
  state: string;
};

export interface AuthService {
  authorize(): AuthResult;
  callback(data: AuthCallbackData): Promise<boolean>;
}

/**
 * Needs to be implemented by user
 */
export interface AuthorizationProvider {
  authorize(): Promise<TokenResponseWithRefresh>;
}

export interface OAuthRequest<T extends TokenProvider = TokenProvider> {
  readonly tokenProvider: T;
  get<T>(path: string, params?: RequestParams): Promise<T>;
  getUri<T>(uri: string): Promise<T>;
  getStream(uri: string): Promise<Readable>;
}
