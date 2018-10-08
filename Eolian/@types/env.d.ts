type Environment = {
  prod: boolean;
  cmdToken: string;
  owners: string[];
  tokens: {
    discord: string;
    youtube: string;
    soundcloud: string;
  };
  invite: boolean;
  db: {
    url: string;
    name: string;
  }
};