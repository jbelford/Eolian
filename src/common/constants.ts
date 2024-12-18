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
  Owner,
}

export const enum Color {
  Help = 0x5a54b8,
  Invite = 0x7985f0,
  Poll = 0x46dbc0,
  Selection = 0xe4ff1c,
  Profile = 0x4286f4,
  Spotify = 0x1db954,
  SoundCloud = 0xff7700,
  YouTube = 0xff0000,
  AI = 0xed19e2,
}

export const IDLE_TIMEOUT_MINS = 60 * 10;

export const DEFAULT_VOLUME = 0.1;

export const GITHUB_PAGE = 'https://github.com/jbelford/Eolian';
export const GITHUB_PAGE_ISSUES = `${GITHUB_PAGE}/issues`;
export const GITHUB_PAGE_WIKI = `${GITHUB_PAGE}/wiki`;
export const GITHUB_PAGE_WIKI_AI = `${GITHUB_PAGE}/wiki`;

export const LOGGER_HEADER = `
__________     __________                    ________      _____
___  ____/________  /__(_)_____ _______      ___  __ )_______  /_
__  __/  _  __ \\_  /__  /_  __ \`/_  __ \\     __  __  |  __ \\  __/
_  /___  / /_/ /  / _  / / /_/ /_  / / /     _  /_/ // /_/ / /_
/_____/  \\____//_/  /_/  \\__,_/ /_/ /_/      /_____/ \\____/\\__/
Copyright 2018-${new Date().getFullYear()} Jack Belford

`;

export const NOT_PLAYING = "I'm not playing anything right now!";
