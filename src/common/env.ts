import { AppEnv } from './@types';

function getEnv(name: string, defaultValue?: string): string {
  if (name in process.env) {
    return process.env[name] as string;
  } else if (defaultValue) {
    return defaultValue;
  }
  console.log(`Missing env: ${name}`);
  process.exit(1);
}

function getNumberEnv(name: string, defaultValue?: number): number {
  if (name in process.env) {
    const value = +(process.env[name] as string);
    if (!isNaN(value)) return value;
  } else if (defaultValue) {
    return defaultValue;
  }
  console.log(`Missing or bad env: ${name}`);
  process.exit(1);
}

function getArrayEnv(name: string): string[] {
  return getEnv(name, '').split(',').map(s => s.trim());
}

export const environment: AppEnv = {
  prod: getEnv('PROD') === 'true',
  debug: getEnv('DEBUG_ENABLED') === 'true',
  cmdToken: getEnv('COMMAND_TOKEN', '!'),
  owners: getArrayEnv('OWNERS'),
  queueLimit: getNumberEnv('DEFAULT_QUEUE_LIMIT', 5000) || 5000,
  youtubeCacheLimit: getNumberEnv('YOUTUBE_CACHE_LIMIT', 1000) || 1000,
  tokens: {
    discord: getEnv('DISCORD_TOKEN'),
    bing: {
      key: getEnv('BING_TOKEN'),
      configId: getEnv('BING_CONFIG_ID'),
    },
    youtube: getEnv('YOUTUBE_TOKEN'),
    soundcloud: {
      clientId: getEnv('SOUNDCLOUD_CLIENT_ID'),
      clientSecret: getEnv('SOUNDCLOUD_CLIENT_SECRET')
    },
    spotify: {
      clientId: getEnv('SPOTIFY_CLIENT_ID'),
      clientSecret: getEnv('SPOTIFY_CLIENT_SECRET')
    }
  },
  mongo: {
    uri: getEnv('MONGO_URI'),
    db_name: getEnv('MONGO_DB_NAME')
  }
};
