import { AppEnv } from './@types';

function getEnvOpt(name: string, defaultValue?: string): string | undefined {
  if (name in process.env) {
    return process.env[name] as string;
  }
  return defaultValue;
}

function getEnv(name: string, defaultValue?: string): string {
  const value = getEnvOpt(name, defaultValue);
  if (value !== undefined) {
    return value;
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

function getBing() {
  const key = getEnvOpt('BING_TOKEN');
  const configId = getEnvOpt('BING_CONFIG_ID');
  if (!key || !configId) {
    return undefined;
  }
  return { key, configId };
}

export const environment: AppEnv = {
  prod: getEnv('NODE_ENV') === 'production',
  debug: getEnv('DEBUG_ENABLED') === 'true',
  cmdToken: getEnv('COMMAND_TOKEN', '!'),
  owners: getArrayEnv('OWNERS'),
  queueLimit: getNumberEnv('DEFAULT_QUEUE_LIMIT', 5000) || 5000,
  youtubeCacheLimit: getNumberEnv('YOUTUBE_CACHE_LIMIT', 1000) || 1000,
  devGuild: getEnvOpt('DEV_GUILD'),
  tokens: {
    discord: {
      clientId: getEnvOpt('DISCORD_CLIENT_ID'),
      main: getEnv('DISCORD_TOKEN'),
      old: getEnvOpt('DISCORD_TOKEN_OLD'),
    },
    bing: getBing(),
    youtube: {
      token: getEnv('YOUTUBE_TOKEN'),
      identityToken: getEnvOpt('YOUTUBE_IDENTITY_TOKEN'),
      cookie: getEnv('YOUTUBE_COOKIE'),
    },
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
