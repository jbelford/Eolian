type Environment = {
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
    }
  };
  invite: boolean;
  db: {
    url: string;
    name: string;
  }
};