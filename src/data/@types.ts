import { Track } from 'api/@types';
import { SyntaxType } from 'commands/@types';
import { AbsRangeArgument, Closable, Idleable } from 'common/@types';
import { SOURCE } from 'common/constants';
import EventEmitter from 'events';

export interface EolianCache<V> extends Closable {
  get(key: string): Promise<V | undefined>;
  del(key: string): Promise<boolean>;
  set(key: string, val: V, ttl?: number): Promise<boolean>;
  refreshTTL(key: string): Promise<boolean>;
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

export interface MusicQueueCache {
  unpop(guildId: string, count: number): Promise<boolean>;
  get(guildId: string, limit?: number): Promise<Track[]>;
  remove(guildId: string, range: AbsRangeArgument): Promise<number>
  add(guildId: string, tracks: Track[], head?: boolean): Promise<void>;
  shuffle(guildId: string): Promise<boolean>;
  clear(guildId: string): Promise<boolean>;
  pop(guildId: string): Promise<Track | undefined>;
  peek(guildId: string): Promise<Track | undefined>;
  peekReverse(guildId: string, idx?: number): Promise<Track | undefined>;
}

export interface ServerQueue extends EventEmitter, Idleable {
  unpop(count: number): Promise<boolean>;
  get(limit?: number): Promise<Track[]>;
  remove(range: AbsRangeArgument): Promise<number>;
  add(tracks: Track[], head?: boolean): Promise<void>;
  shuffle(): Promise<boolean>;
  clear(): Promise<boolean>;
  pop(): Promise<Track | undefined>;
  peek(): Promise<Track | undefined>;
  peekReverse(idx?: number): Promise<Track | undefined>;
}
