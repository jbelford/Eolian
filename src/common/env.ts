import { Environment } from './@types';

export const environment: Environment = {
  prod: process.env.PROD === 'true',
  cmdToken: process.env.COMMAND_TOKEN || '!',
  owners: process.env.OWNERS ? process.env.OWNERS.split(',').map(s => s.trim()) : [],
  tokens: {
    discord: process.env.DISCORD_TOKEN || '',
    youtube: process.env.YOUTUBE_TOKEN || '',
    soundcloud: process.env.SOUNDCLOUD_TOKEN || '',
    spotify: {
      clientId: process.env.SPOTIFY_CLIENT_ID || '',
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || ''
    }
  }
};
