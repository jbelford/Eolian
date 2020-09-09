import { ClientOptions, Intents, PermissionResolvable } from 'discord.js';

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
}

export enum SOURCE {
  UNKNOWN = 0,
  SPOTIFY,
  YOUTUBE,
  SOUNDCLOUD
}

export function getEnumName(e: any, i: number) {
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
};

export const enum DiscordChannel {
  TEXT = 'text',
  VOICE = 'voice'
};

export const EOLIAN_CLIENT_OPTIONS: ClientOptions = {
  ws: { intents: DISCORD_ENABLED_INTENTS }
};