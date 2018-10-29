const environment: Environment = {
  prod: false,
  cmdToken: '!',
  owners: ['mockOwner'],
  tokens: {
    discord: 'mockDiscord',
    youtube: 'mockYoutube',
    soundcloud: 'mockSoundCloud',
    spotify: {
      clientId: "mockSpotifyId",
      clientSecret: "mockSpotifySecret"
    }
  },
  db: {
    url: 'mongoUrl',
    name: 'dbName'
  }
};

export = environment;