
export interface Closable {
  close(): Promise<void>;
}

export interface Idleable {
  readonly idle: boolean;
}

export interface AppEnv {
  prod: boolean;
  debug: boolean;
  cmdToken: string;
  owners: string[];
  queueLimit: number;
  youtubeCacheLimit: number;
  tokens: {
    discord: {
      main: string;
      old?: string;
    };
    bing?: {
      key: string;
      configId: string;
    };
    youtube: {
      token: string;
      identityToken?: string;
      cookie: string;
    };
    soundcloud: {
      clientId: string;
      clientSecret: string;
    };
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

export interface ProgressUpdater {
  init(total?: number): void;
  update(value: number): void;
  done(): Promise<void>;
}

export interface RetrySleepAlgorithm {
  readonly count: number;
  reset(): void;
  sleep(): Promise<void>;
}