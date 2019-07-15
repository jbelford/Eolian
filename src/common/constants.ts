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

export const enum IDENTIFIER_TYPE {
  PLAYLIST = 0,
  ALBUM,
  FAVORITES,
  ARTIST,
  SONG,
  TRACKS
}

export const enum SOURCE {
  UNKNOWN = 0,
  SPOTIFY,
  YOUTUBE,
  SOUNDCLOUD
}