import { afterEach, vi } from 'vitest';

Object.assign(process.env, {
  NODE_ENV: 'test',
  DISCORD_TOKEN: 'test',
  YOUTUBE_TOKEN: 'test',
  SOUNDCLOUD_CLIENT_ID: 'test',
  SOUNDCLOUD_CLIENT_SECRET: 'test',
  SPOTIFY_CLIENT_ID: 'test',
  SPOTIFY_CLIENT_SECRET: 'test',
  SPEECH_SERVICE_KEY: 'test',
  SPEECH_SERVICE_REGION: 'test',
  MONGO_URI: 'mongodb://localhost/test',
  MONGO_DB_NAME: 'test',
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
