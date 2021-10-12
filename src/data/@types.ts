import { Track } from 'api/@types';
import { SyntaxType } from 'commands/@types';
import { Closable, Idleable } from 'common/@types';
import { SOURCE } from 'common/constants';
import EventEmitter from 'events';

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
  setSpotify(id: string, spotify: string): Promise<void>;
  removeSpotify(id: string): Promise<void>;
  setIdentifier(id: string, key: string, identifier: Identifier): Promise<void>;
  removeIdentifier(id: string, key: string): Promise<boolean>;
}

export interface ServersDb extends CollectionDb<ServerDTO> {
  setPrefix(id: string, prefix: string): Promise<void>;
  setVolume(id: string, volume: number): Promise<void>;
  setSyntax(id: string, type: SyntaxType): Promise<void>;
}

export interface DocDTO {
  _id: string;
}

export interface ServerDTO extends DocDTO {
  prefix?: string;
  volume?: number;
  syntax?: SyntaxType;
  queueLimit?: number;
}

export interface UserDTO extends DocDTO {
  soundcloud?: number;
  spotify?: string;
  identifiers?: { [key: string]: Identifier };
}

export interface Identifier {
  type: IdentifierType;
  src: SOURCE;
  id: string;
  url: string;
}

export enum IdentifierType {
  PLAYLIST = 0,
  ALBUM,
  LIKES,
  ARTIST,
  SONG,
  TRACKS
}

export interface MemoryStore extends Closable {
  readonly queue: MusicQueueCache;
}

export interface ListCache<V> extends Closable {
  size(key: string): Promise<number>;
  lpop(key: string, count?: number): Promise<V[]>;
  rpop(key: string, count?: number): Promise<V[]>;
  lpush(key: string, items: V[]): Promise<void>;
  rpush(key: string, items: V[]): Promise<void>;
  peek(key: string, idx?: number): Promise<V | undefined>;
  get(key: string): Promise<V[]>;
  set(key: string, items: V[]): Promise<void>;
  del(key: string): Promise<boolean>;
  range(key: string, offset: number, count: number): Promise<V[]>;
  remove(key: string, offset: number, count: number): Promise<number>;
}

export interface MusicQueueCache {
  size(guildId: string): Promise<number>;
  pop(guildId: string, loop?: boolean): Promise<Track | undefined>;
  unpop(guildId: string, count: number, loop?: boolean): Promise<boolean>;
  get(guildId: string, index: number, count: number): Promise<Track[]>;
  remove(guildId: string, index: number, count: number): Promise<number>
  move(guildId: string, to: number, from: number, count: number): Promise<void>;
  add(guildId: string, tracks: Track[], head?: boolean): Promise<void>;
  shuffle(guildId: string): Promise<boolean>;
  clear(guildId: string): Promise<boolean>;
  clearPrev(guildId: string): Promise<void>;
  peek(guildId: string): Promise<Track | undefined>;
  peekReverse(guildId: string, idx: number, loop?: boolean): Promise<Track | undefined>;
}

export interface ServerQueue extends EventEmitter, Idleable {
  loop: boolean;
  setLoopMode(enabled: boolean): Promise<void>;
  size(): Promise<number>;
  unpop(count: number): Promise<boolean>;
  get(index: number, count: number): Promise<Track[]>;
  remove(index: number, count: number): Promise<number>;
  move(to: number, from: number, count: number): Promise<void>;
  add(tracks: Track[], head?: boolean): Promise<void>;
  shuffle(): Promise<boolean>;
  clear(): Promise<boolean>;
  pop(): Promise<Track | undefined>;
  peek(): Promise<Track | undefined>;
  peekReverse(idx?: number): Promise<Track | undefined>;
}
