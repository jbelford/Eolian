import { afterEach, vi } from 'vitest';

Object.assign(process.env, {
  NODE_ENV: 'test',
  BASE_URI: 'http://localhost:8080',
  DISCORD_CLIENT_ID: 'test-client',
  DISCORD_CLIENT_SECRET: 'test-secret',
  DISCORD_TOKEN: 'test',
  SESSION_SECRET: 'test-session-secret-at-least-32-bytes',
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
