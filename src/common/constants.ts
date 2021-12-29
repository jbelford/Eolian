
export const NUMBER_TO_EMOJI = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

export const EMOJI_TO_NUMBER: Record<string, number> = {};
for (let i = 0; i < NUMBER_TO_EMOJI.length; ++i) {
  EMOJI_TO_NUMBER[NUMBER_TO_EMOJI[i]] = i;
}

export const enum PERMISSION {
  UNKNOWN = 0,
  USER,
  DJ_LIMITED,
  DJ,
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

export const IDLE_TIMEOUT_MINS = 60 * 10;

export const DEFAULT_VOLUME = 0.10;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function getEnumName(e: any, i: number): string | undefined {
  return Object.keys(e).find(k => e[k] === i);
}

export const GITHUB_PAGE = 'https://github.com/jbelford/Eolian';
export const GITHUB_PAGE_ISSUES = `${GITHUB_PAGE}/issues`;
export const GITHUB_PAGE_WIKI = `${GITHUB_PAGE}/wiki`;
