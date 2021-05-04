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

function getArrayEnv(name: string): string[] {
  return getEnv(name, '').split(',').map(s => s.trim());
}

export const environment: AppEnv = {
  prod: getEnv('PROD') === 'true',
  cmdToken: getEnv('COMMAND_TOKEN', '!'),
  owners: getArrayEnv('OWNERS'),
  tokens: {
    discord: getEnv('DISCORD_TOKEN'),
    youtube: getEnv('YOUTUBE_TOKEN'),
    soundcloud: getEnv('SOUNDCLOUD_TOKEN'),
    spotify: {
      clientId: getEnv('SPOTIFY_CLIENT_ID'),
      clientSecret: getEnv('SPOTIFY_CLIENT_SECRET')
    }
  }
};
