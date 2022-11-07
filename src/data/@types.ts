import { TrackSource } from '@eolian/api/@types';
import { SyntaxType } from '@eolian/commands/@types';
import { Closable } from '@eolian/common/@types';

export interface EolianCache<V> extends Closable {
  get(key: string): Promise<V | undefined>;
  del(key: string): Promise<boolean>;
  set(key: string, val: V, ttl?: number): Promise<boolean>;
  refreshTTL(key: string): Promise<boolean>;
}

export interface MemoryCache<T> {
  get(id: string): T | undefined;
  set(id: string, val: T): void;
}

export interface AppDatabase extends Closable {
  readonly users: UsersDb;
  readonly servers: ServersDb;
}

export interface CollectionDb<T> {
  get(id: string): Promise<T | null>;
  delete(id: string): Promise<boolean>;
}

export interface UsersDb extends CollectionDb<UserDTO> {
  setSoundCloud(id: string, soundcloud: number): Promise<void>;
  removeSoundCloud(id: string): Promise<void>;
  setSoundCloudRefreshToken(id: string, token: string): Promise<void>;
  removeSoundCloudRefreshToken(id: string): Promise<void>;
  setSpotifyRefreshToken(id: string, token: string): Promise<void>;
  setSpotify(id: string, spotify: string): Promise<void>;
  removeSpotify(id: string): Promise<void>;
  removeSpotifyRefreshToken(id: string): Promise<void>;
  setIdentifier(id: string, key: string, identifier: Identifier): Promise<void>;
  removeIdentifier(id: string, key: string): Promise<boolean>;
}

export interface ServersDb extends CollectionDb<ServerDTO> {
  getIdleServers(minDate: Date): Promise<ServerDTO[]>;
  setLastUsage(id: string, usageDate: Date): Promise<void>;
  setPrefix(id: string, prefix: string): Promise<void>;
  setVolume(id: string, volume: number): Promise<void>;
  setSyntax(id: string, type: SyntaxType): Promise<void>;
  addDjRole(id: string, roleId: string): Promise<void>;
  removeDjRole(id: string, roleId: string): Promise<boolean>;
  setDjAllowLimited(id: string, allow: boolean): Promise<void>;
}

export interface DocDTO {
  _id: string;
}

export interface ServerDTO extends DocDTO {
  lastUsage?: Date;
  prefix?: string;
  volume?: number;
  syntax?: SyntaxType;
  queueLimit?: number;
  djRoleIds?: string[];
  djAllowLimited?: boolean;
}

export interface UserDTO extends DocDTO {
  soundcloud?: number;
  spotify?: string;
  tokens?: {
    spotify?: string;
    soundcloud?: string;
  };
  identifiers?: Record<string, Identifier>;
}

export interface Identifier {
  type: ResourceType;
  src: TrackSource;
  id: string;
  url: string;
  auth?: boolean;
}

export const enum ResourceType {
  Playlist = 0,
  Album,
  Likes,
  Artist,
  Song,
  Tracks,
}

export interface ListCache<V> extends Closable {
  size(key: string): Promise<number>;
  lpop(key: string, count?: number): Promise<V[]>;
  rpop(key: string, count?: number): Promise<V[]>;
  lpush(key: string, items: V[]): Promise<void>;
  rpush(key: string, items: V[]): Promise<void>;
  lpeek(key: string, idx?: number): Promise<V | undefined>;
  rpeek(key: string, idx?: number): Promise<V | undefined>;
  get(key: string): Promise<V[]>;
  set(key: string, items: V[]): Promise<void>;
  del(key: string): Promise<boolean>;
  range(key: string, offset: number, count: number): Promise<V[]>;
  remove(key: string, offset: number, count: number): Promise<number>;
}

export interface QueueCache<T> {
  size(key: string, loop?: boolean): Promise<number>;
  pop(key: string, loop?: boolean): Promise<T | undefined>;
  unpop(key: string, count: number): Promise<boolean>;
  get(key: string, index: number, count: number): Promise<T[]>;
  getLoop(key: string, count: number): Promise<T[]>;
  remove(key: string, index: number, count: number): Promise<number>;
  move(key: string, to: number, from: number, count: number): Promise<void>;
  add(key: string, items: T[], head?: boolean): Promise<void>;
  shuffle(key: string): Promise<boolean>;
  clear(key: string): Promise<boolean>;
  clearPrev(key: string): Promise<void>;
  peek(key: string, loop?: boolean): Promise<T | undefined>;
  peekReverse(key: string, idx: number): Promise<T | undefined>;
}

export const enum FeatureFlag {
  /**
   * Feature flag enables user authentication with Spotify.
   * Certain features such as liked and top tracks can only be used with this.
   */
  SPOTIFY_AUTH = 0,
  SOUNDCLOUD_AUTH,
  /**
   * Leave old servers when migrating token
   */
  DISCORD_OLD_LEAVE,
}

export interface FeatureFlagService {
  enabled(flag: FeatureFlag): boolean;
}
