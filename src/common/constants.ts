import { ClientOptions, PermissionResolvable, WSEventType } from 'discord.js';

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


const DISCORD_DISABLED_EVENTS: WSEventType[] = [
  // 'READY',
  // 'RESUMED',
  // 'GUILD_SYNC',
  // 'GUILD_CREATE',
  // 'GUILD_DELETE',
  // 'GUILD_UPDATE',
  'GUILD_MEMBER_ADD',
  'GUILD_MEMBER_REMOVE',
  'GUILD_MEMBER_UPDATE',
  'GUILD_MEMBERS_CHUNK',
  'GUILD_ROLE_CREATE',
  'GUILD_ROLE_DELETE',
  'GUILD_ROLE_UPDATE',
  'GUILD_BAN_ADD',
  'GUILD_BAN_REMOVE',
  'CHANNEL_CREATE',
  'CHANNEL_DELETE',
  'CHANNEL_UPDATE',
  'CHANNEL_PINS_UPDATE',
  // 'MESSAGE_CREATE',
  'MESSAGE_DELETE',
  'MESSAGE_UPDATE',
  'MESSAGE_DELETE_BULK',
  // 'MESSAGE_REACTION_ADD',
  'MESSAGE_REACTION_REMOVE',
  'MESSAGE_REACTION_REMOVE_ALL',
  'USER_UPDATE',
  'USER_NOTE_UPDATE',
  'USER_SETTINGS_UPDATE',
  'PRESENCE_UPDATE',
  // 'VOICE_STATE_UPDATE',
  'TYPING_START',
  // 'VOICE_SERVER_UPDATE',
  'RELATIONSHIP_ADD',
  'RELATIONSHIP_REMOVE',
];

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
  disabledEvents: DISCORD_DISABLED_EVENTS
};