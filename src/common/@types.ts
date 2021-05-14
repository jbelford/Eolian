
export interface Closable {
  close(): Promise<void>;
}

export interface AppEnv {
  prod: boolean;
  debug: boolean;
  cmdToken: string;
  owners: string[];
  tokens: {
    discord: string;
    youtube: string;
    soundcloud: string;
    spotify: {
      clientId: string;
      clientSecret: string;
    };
  };
  mongo: {
    uri: string;
    db_name: string;
  }
}

export interface RangeArgument {
  start: number;
  stop?: number;
}

export interface AbsRangeArgument {
  start: number;
  stop: number;
}