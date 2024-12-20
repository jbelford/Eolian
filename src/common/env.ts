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
  return getEnv(name, '')
    .split(',')
    .map(s => s.trim());
}

function getBing() {
  const key = getEnvOpt('BING_TOKEN');
  const configId = getEnvOpt('BING_CONFIG_ID');
  if (!key || !configId) {
    return undefined;
  }
  return { key, configId };
}

function getEnvFlag(name: string): boolean {
  return getEnvOpt(name) === 'true';
}

function getProxyEnv(): AppEnv['proxy'] {
  const proxyUser = getEnvOpt('HTTP_PROXY_USER');
  const proxyPass = getEnvOpt('HTTP_PROXY_PASSWORD');
  const proxyName = getEnvOpt('HTTP_PROXY_NAME');
  if (!proxyUser || !proxyPass || !proxyName) {
    return undefined;
  }
  return {
    name: proxyName,
    password: proxyPass,
    user: proxyUser,
  };
}

function getAzureOpenAi() {
  const apiKey = getEnvOpt('AZURE_OPENAI_KEY');
  const endpoint = getEnvOpt('AZURE_OPENAI_ENDPOINT');
  const deployment = getEnvOpt('AZURE_OPENAI_DEPLOYMENT');
  const apiVersion = getEnvOpt('AZURE_OPENAI_API_VERSION');
  if (!apiKey || !endpoint || !deployment || !apiVersion) {
    return undefined;
  }
  return { apiKey, endpoint, deployment, apiVersion };
}

function getOpenAi() {
  const apiKey = getEnvOpt('OPENAI_API_KEY');
  const ttsModel = getEnvOpt('OPENAI_TTS_MODEL');
  const audioModel = getEnvOpt('OPENAI_AUDIO_MODEL');
  if (!apiKey) {
    return undefined;
  }
  return { apiKey, ttsModel, audioModel };
}

export const environment: AppEnv = {
  prod: getEnv('NODE_ENV') === 'production',
  debug: getEnvFlag('DEBUG_ENABLED'),
  cmdToken: getEnv('COMMAND_TOKEN', '!'),
  owners: getArrayEnv('OWNERS'),
  ownerGuild: getEnvOpt('OWNER_GUILD'),
  port: getNumberEnv('PORT', 8080) || 8080,
  baseUri: getEnv('BASE_URI', 'http://localhost:8080'),
  // @ts-ignore
  commitDate: __COMMIT_DATE__,
  proxy: getProxyEnv(),
  youtubeAllowList: new Set(getArrayEnv('YOUTUBE_ALLOWLIST')),
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
      cookie: getEnvOpt('YOUTUBE_COOKIE'),
      poToken: getEnvOpt('YOUTUBE_PO_TOKEN'),
      visitorData: getEnvOpt('YOUTUBE_VISITOR_DATA'),
    },
    soundcloud: {
      clientId: getEnv('SOUNDCLOUD_CLIENT_ID'),
      clientSecret: getEnv('SOUNDCLOUD_CLIENT_SECRET'),
    },
    spotify: {
      clientId: getEnv('SPOTIFY_CLIENT_ID'),
      clientSecret: getEnv('SPOTIFY_CLIENT_SECRET'),
    },
    openai: getOpenAi(),
    azureOpenAi: getAzureOpenAi(),
    speech: {
      key: getEnv('SPEECH_SERVICE_KEY'),
      region: getEnv('SPEECH_SERVICE_REGION'),
    },
  },
  mongo: {
    uri: getEnv('MONGO_URI'),
    db_name: getEnv('MONGO_DB_NAME'),
  },
  config: {
    queueLimit: getNumberEnv('DEFAULT_QUEUE_LIMIT', 5000) || 5000,
    youtubeCacheLimit: getNumberEnv('YOUTUBE_CACHE_LIMIT', 1000) || 1000,
    guildCacheTTL: getNumberEnv('GUILD_CACHE_TTL', 60 * 15) || 60 * 15,
  },
  flags: {
    spotifyUserAuth: getEnvFlag('FLAG_SPOTIFY_OAUTH'),
    soundcloudUserAuth: getEnvFlag('FLAG_SOUNDCLOUD_OAUTH'),
    discordOldLeave: getEnvFlag('FLAG_DISCORD_OLD_LEAVE'),
    enableWebsite: getEnvFlag('FLAG_ENABLE_WEBSITE'),
  },
};
