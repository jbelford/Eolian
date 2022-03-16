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
  ownerGuild?: string;
  port: number;
  baseUri: string;
  tokens: {
    discord: {
      clientId?: string;
      main: string;
      old?: string;
      oldLeave?: boolean;
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
  };
  config: {
    queueLimit: number;
    youtubeCacheLimit: number;
    guildCacheTTL: number;
  };
  flags: {
    spotifyUserAuth: boolean;
    soundcloudUserAuth: boolean;
    discordOldLeave: boolean;
  };
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
