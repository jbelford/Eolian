import { Closable } from 'common/@types';
import { SOURCE } from 'common/constants';
import { Player, Track } from 'music/@types';

export interface EolianCache {
  get<T>(id: string): Promise<T | undefined>;
  del(id: string): Promise<boolean>;
  set<T>(id: string, val: T, ttl?: number): Promise<boolean>;
  mset<T>(pairs: Array<{ id: string, val: T }>): Promise<number>;
  getOrSet<T>(id: string, fn: () => Promise<T> | T): Promise<[T, boolean]>;
}

export interface Database extends Closable {
  readonly users: UsersDAO;
}

export interface UsersDAO {
  get(id: string): Promise<UserDTO>;
  setSoundCloud(id: string, soundcloud: number): Promise<void>;
  removeSoundCloud(id: string): Promise<void>;
  setSpotify(id: string, spotify: string): Promise<void>;
  removeSpotify(id: string): Promise<void>;
  setIdentifier(id: string, key: string, identifier: Identifier): Promise<void>;
  removeIdentifier(id: string, key: string): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export interface UserDTO {
  id: string;
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
  FAVORITES,
  ARTIST,
  SONG,
  TRACKS
}

export interface MemoryStore extends Closable {
  readonly queueDao: MusicQueueDAO;
  readonly playerStore: PlayerStore;
}

export interface MusicQueueDAO {
  get(guildId: string, limit?: number): Promise<Track[]>;
  add(guildId: string, tracks: Track[], head?: boolean): Promise<void>;
  shuffle(guildId: string): Promise<boolean>;
  clear(guildId: string): Promise<boolean>;
  pop(guildId: string): Promise<Track | undefined>;
  peek(guildId: string): Promise<Track | undefined>;
}

export interface PlayerStore {
  get(guildId: string): Player | undefined;
  store(guildId: string, player: Player): void;
}