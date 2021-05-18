import { AbsRangeArgument, Closable } from 'common/@types';
import { SOURCE } from 'common/constants';
import { ContextTextChannel } from 'eolian/@types';
import EventEmitter from 'events';
import { Player, Track } from 'music/@types';

export interface EolianCache<V> extends Closable {
  get(key: string): Promise<V | undefined>;
  del(key: string): Promise<boolean>;
  set(key: string, val: V, ttl?: number): Promise<boolean>;
}

export interface AppDatabase extends Closable {
  readonly users: UsersDAO;
}

export interface UsersDAO {
  get(id: string): Promise<UserDTO>;
  setSoundCloud(id: string, soundcloud: number): Promise<void>;
  removeSoundCloud(id: string): Promise<void>;
  setSpotify(id: string, spotify: string): Promise<void>;
  removeSpotify(id: string): Promise<void>;
  setIdentifier(id: string, key: string, identifier: Identifier): Promise<void>;
  removeIdentifier(id: string, key: string): Promise<boolean>;
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

export interface SoundCloudUserIdentifier extends Identifier {
  favorites: number;
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
}

export interface MusicQueueDAO {
  unpop(guildId: string, count: number): Promise<boolean>;
  get(guildId: string, limit?: number): Promise<Track[]>;
  remove(guildId: string, range: AbsRangeArgument): Promise<number>
  add(guildId: string, tracks: Track[], head?: boolean): Promise<void>;
  shuffle(guildId: string): Promise<boolean>;
  clear(guildId: string): Promise<boolean>;
  pop(guildId: string): Promise<Track | undefined>;
  peek(guildId: string): Promise<Track | undefined>;
}

export interface ServerQueue extends EventEmitter {
  unpop(count: number): Promise<boolean>;
  get(limit?: number): Promise<Track[]>;
  remove(range: AbsRangeArgument): Promise<number>;
  add(tracks: Track[], head?: boolean): Promise<void>;
  shuffle(): Promise<boolean>;
  clear(): Promise<boolean>;
  pop(): Promise<Track | undefined>;
  peek(): Promise<Track | undefined>;
}

export interface Display {
  setChannel(channel: ContextTextChannel): void;
}

export interface PlayerDisplay extends Display {
}

export interface QueueDisplay extends Display {
  setChannel(channel: ContextTextChannel): void;
  send(tracks: Track[], start?: number, total?: number): Promise<void>;
  delete(): Promise<void>;
}

export interface ServerStateStore {
  get(id: string): ServerState | undefined;
  set(id: string, context: ServerState): void;
}

export interface ServerState {
  player: Player;
  queue: ServerQueue;
  display: {
    queue: QueueDisplay;
    player: PlayerDisplay;
  }
}