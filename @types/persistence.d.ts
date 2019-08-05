interface Database extends Closable {

  readonly usersDao: UsersDAO;

}

interface MemoryStore extends Closable {

  readonly queueDao: MusicQueueDAO;

}

interface EolianCache {

  get<T>(id: string): Promise<T | undefined>;

  del(id: string): Promise<boolean>;

  set<T>(id: string, val: T, ttl?: number): Promise<boolean>;

  mset<T>(pairs: { id: string, val: T }[]): Promise<number>;

  getOrSet<T>(id: string, fn: () => Promise<T> | T): Promise<[T, boolean]>;

}

interface UsersDAO {

  get(id: string): Promise<UserDTO>;

  setSoundCloud(id: string, soundcloud: number): Promise<void>;
  removeSoundCloud(id: string): Promise<void>;

  setSpotify(id: string, spotify: string): Promise<void>;
  removeSpotify(id: string): Promise<void>;

  setIdentifier(id: string, key: string, identifier: Identifier): Promise<void>;
  removeIdentifier(id: string, key: string): Promise<void>;

  delete(id: string): Promise<boolean>;

}

type UserDTO = {
  id: string;
  soundcloud?: number;
  spotify?: string;
  identifiers?: { [key: string]: Identifier };
}

type Identifier = {
  type: import('common/constants').IDENTIFIER_TYPE;
  src: import('common/constants').SOURCE;
  id: string;
  url: string;
}

interface MusicQueueDAO {

  get(guildId: string, limit?: number): Promise<Track[]>;

  add(guildId: string, tracks: Track[], head?: boolean): Promise<void>;

  shuffle(guildId: string): Promise<boolean>;

  clear(guildId: string): Promise<boolean>;

  pop(guildId: string): Promise<Track | undefined>;

  peek(guildId: string): Promise<Track | undefined>;

}

type QueueDTO = {
  id: string;
  tracks: Track[];
};