interface Database {

  readonly usersDao: UsersDAO;

  cleanup(): Promise<void>;

}

interface UsersDAO {

  get(id: string): Promise<UserDTO>;

  setSoundCloud(id: string, soundcloud: number): Promise<void>;
  removeSoundCloud(id: string): Promise<void>;

  setSpotify(id: string, spotify: string): Promise<void>;
  removeSpotify(id: string): Promise<void>;

  setIdentifier(id: string, key: string, identifer: Identifier): Promise<void>;
  removeIdentifier(id: string, key: string): Promise<void>;

}

type UserDTO = {
  id: string;
  soundcloud: number;
  spotify: string;
  identifiers: { [key: string]: Identifier };
}

type Identifier = {
  type: import('../src/common/constants').IDENTIFIER_TYPE,
  src: import('../src/common/constants').SOURCE,
  id: string
}