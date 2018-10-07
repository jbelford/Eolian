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
  socket: {
    client: string;
    server: string;
  };
  db: {
    url: string;
    name: string;
  }
};