import { ClientOptions, Intents, PermissionResolvable } from 'discord.js';

export const NUMBER_TO_EMOJI = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

export const EMOJI_TO_NUMBER: { [key: string]: number } = {};
for (let i = 0; i < NUMBER_TO_EMOJI.length; ++i) {
  EMOJI_TO_NUMBER[NUMBER_TO_EMOJI[i]] = i;
}

export const enum PERMISSION {
  UNKNOWN = 0,
  USER,
  ADMIN,
  OWNER
}

export const enum COLOR {
  HELP = 0x5A54B8,
  INVITE = 0x7985f0,
  POLL = 0x46DBC0,
  SELECTION = 0xe4ff1c,
  PROFILE = 0x4286f4,
  SPOTIFY = 0x1DB954,
  SOUNDCLOUD = 0xFF7700,
  YOUTUBE = 0xFF0000
}

export function mapSourceToColor(src: SOURCE): COLOR {
  switch (src) {
    case SOURCE.SOUNDCLOUD:
      return COLOR.SOUNDCLOUD;
    case SOURCE.SPOTIFY:
      return COLOR.SPOTIFY;
    case SOURCE.YOUTUBE:
    default:
      return COLOR.YOUTUBE;
  }
}

export enum SOURCE {
  UNKNOWN = 0,
  SPOTIFY,
  YOUTUBE,
  SOUNDCLOUD
}

export const IDLE_TIMEOUT = 60 * 10;


export function getIcon(src: SOURCE): string | undefined {
  switch (src) {
    case SOURCE.SOUNDCLOUD:
      return 'https://www.dropbox.com/s/ub1jhziixrc00da/soundcloud_icon.png?raw=1';
    case SOURCE.SPOTIFY:
      return 'https://www.dropbox.com/s/l1q0wrz2a5w0i64/spotify_icon.png?raw=1';
    case SOURCE.YOUTUBE:
      return 'https://www.dropbox.com/s/m6dwdgwwf06d67g/youtube_icon.png?raw=1';
    default:
      return undefined;
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getEnumName(e: any, i: number): string | undefined {
  return Object.keys(e).find(k => e[k] === i);
}

// https://discord.com/developers/docs/topics/gateway#list-of-intents
const DISCORD_ENABLED_INTENTS = new Intents();
DISCORD_ENABLED_INTENTS.add(
  'GUILDS',
  // 'GUILD_MEMBERS',
  // 'GUILD_EMOJIS',
  // 'GUILD_INTEGRATIONS',
  // 'GUILD_WEBHOOKS',
  'GUILD_INVITES',
  'GUILD_VOICE_STATES',
  // 'GUILD_PRESENCES',
  'GUILD_MESSAGES',
  'GUILD_MESSAGE_REACTIONS',
  // 'GUILD_MESSAGE_TYPING',
  // 'DIRECT_MESSAGE_TYPING',
  'DIRECT_MESSAGES',
  'DIRECT_MESSAGE_REACTIONS');

export const DISCORD_INVITE_PERMISSIONS: PermissionResolvable = [
  'ADD_REACTIONS',
  'ATTACH_FILES',
  'CONNECT',
  'EMBED_LINKS',
  'MANAGE_EMOJIS',
  'MANAGE_MESSAGES',
  'MENTION_EVERYONE',
  'PRIORITY_SPEAKER',
  'READ_MESSAGE_HISTORY',
  'SEND_MESSAGES',
  'SEND_TTS_MESSAGES',
  'SPEAK',
  'USE_EXTERNAL_EMOJIS',
  'VIEW_CHANNEL',
];

export const enum DiscordEvents {
  READY = 'ready',
  MESSAGE = 'message',
  ERROR = 'error',
  RECONNECTING = 'reconnecting',
  RESUME = 'resume',
  DEBUG = 'debug',
  WARN = 'warn',
  MESSAGE_REACTION_ADD = 'messageReactionAdd',
}

export const enum DiscordChannel {
  TEXT = 'text',
  DM = 'dm',
  VOICE = 'voice'
}

export const EOLIAN_CLIENT_OPTIONS: ClientOptions = {
  ws: { intents: DISCORD_ENABLED_INTENTS }
};