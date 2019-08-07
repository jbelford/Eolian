
export interface Closable {
  close(): Promise<void>;
}

export interface Environment {
  prod: boolean;
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
}