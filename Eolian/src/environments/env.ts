
const environment: Environment = {
  prod: process.env.PROD === 'true',
  cmdToken: process.env.COMMAND_TOKEN,
  owners: process.env.OWNERS.split(',').map(s => s.trim()),
  tokens: {
    discord: process.env.DISCORD_TOKEN,
    youtube: process.env.YOUTUBE_TOKEN,
    soundcloud: process.env.SOUNDCLOUD_TOKEN,
    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET
    }
  },
  mongo: {
    url: process.env.DB_URL,
    name: process.env.DB_NAME
  },
  google: {
    projectId: process.env.GOOGLE_PROJECT_ID,
    serviceKey: {
      firestore: process.env.GOOGLE_FIRESTORE_KEY_PATH
    }
  }
};

export default environment;