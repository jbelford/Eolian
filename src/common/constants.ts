
export const NUMBER_TO_EMOJI = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

export const EMOJI_TO_NUMBER: Record<string, number> = {};
for (let i = 0; i < NUMBER_TO_EMOJI.length; ++i) {
  EMOJI_TO_NUMBER[NUMBER_TO_EMOJI[i]] = i;
}

export const enum UserPermission {
  Unknown = 0,
  User,
  DJLimited,
  DJ,
  Admin,
  Owner
}

export const enum Color {
  Help = 0x5A54B8,
  Invite = 0x7985f0,
  Poll = 0x46DBC0,
  Selection = 0xe4ff1c,
  Profile = 0x4286f4,
  Spotify = 0x1DB954,
  SoundCloud = 0xFF7700,
  YouTube = 0xFF0000
}

export const IDLE_TIMEOUT_MINS = 60 * 10;

export const DEFAULT_VOLUME = 0.10;

export const GITHUB_PAGE = 'https://github.com/jbelford/Eolian';
export const GITHUB_PAGE_ISSUES = `${GITHUB_PAGE}/issues`;
export const GITHUB_PAGE_WIKI = `${GITHUB_PAGE}/wiki`;
