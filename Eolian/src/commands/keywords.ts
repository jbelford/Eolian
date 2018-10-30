import { PERMISSION, SOURCE } from "common/constants";

export const KEYWORDS: IKeywords = {
  ENABLE: {
    name: 'ENABLE',
    details: 'Indicates to enable a particular feature',
    permission: PERMISSION.OWNER,
    usage: ['enable'],
    priority: 0,
    matchText: (text: string) => defaultMatch(text, /\benable\b/i),
  },
  DISABLE: {
    name: 'DISABLE',
    details: 'Indicates to disable a particular feature',
    permission: PERMISSION.OWNER,
    usage: ['disable'],
    priority: 0,
    matchText: (text: string) => defaultMatch(text, /\bdisable\b/i),
  },
  CLEAR: {
    name: 'CLEAR',
    details: 'Indicates to remove some data',
    permission: PERMISSION.USER,
    usage: ['clear'],
    priority: 0,
    matchText: (text: string) => defaultMatch(text, /\bclear\b/i),
  },
  MORE: {
    name: 'MORE',
    details: 'Indicates to increase a value',
    permission: PERMISSION.USER,
    usage: ['more'],
    priority: 0,
    matchText: (text: string) => defaultMatch(text, /\bmore\b/i),
  },
  LESS: {
    name: 'LESS',
    details: 'Indicates to decrease a value',
    permission: PERMISSION.USER,
    usage: ['less'],
    priority: 0,
    matchText: (text: string) => defaultMatch(text, /\bless\b/i),
  },
  MY: {
    name: 'MY',
    details: 'Indicates to fetch information from your account. Be it SoundCloud or Spotify.',
    permission: PERMISSION.USER,
    usage: ['my'],
    priority: 0,
    matchText: (text: string) => defaultMatch(text, /\bmy\b/i)
  },
  SOUNDCLOUD: {
    name: 'SOUNDCLOUD',
    details: 'Indicates to fetch a resource from SoundCloud if applicable',
    permission: PERMISSION.USER,
    usage: ['soundcloud'],
    priority: 0,
    matchText: (text: string) => defaultMatch(text, /\bsoundcloud\b/i),
  },
  SPOTIFY: {
    name: 'SPOTIFY',
    details: 'Indicates to fetch a resource from Spotify if applicable',
    permission: PERMISSION.USER,
    usage: ['spotify'],
    priority: 0,
    matchText: (text: string) => defaultMatch(text, /\bspotify\b/i),
  },
  YOUTUBE: {
    name: 'YOUTUBE',
    details: 'Indicates to fetch a resource from YouTube if applicable',
    permission: PERMISSION.USER,
    usage: ['youtube'],
    priority: 0,
    matchText: (text: string) => defaultMatch(text, /\byoutube\b/i),
  },
  PLAYLIST: {
    name: 'PLAYLIST',
    details: 'Indicates to fetch songs from a playlist given a query',
    permission: PERMISSION.USER,
    usage: ['playlist'],
    priority: 0,
    matchText: (text: string) => defaultMatch(text, /\bplaylist\b/i),
  },
  ALBUM: {
    name: 'ALBUM',
    details: 'Indicates to fetch songs from an album given a query',
    permission: PERMISSION.USER,
    usage: ['album'],
    priority: 0,
    matchText: (text: string) => defaultMatch(text, /\balbum\b/i),
  },
  ARTIST: {
    name: 'ARTIST',
    details: 'Indicates to fetch songs for an artist given the query',
    permission: PERMISSION.USER,
    usage: ['artist'],
    priority: 0,
    matchText: (text: string) => defaultMatch(text, /\bartist\b/i),
  },
  NEXT: {
    name: 'NEXT',
    details: 'Indicates to place fetched tracks at the top of the queue',
    permission: PERMISSION.USER,
    usage: ['next'],
    priority: 0,
    matchText: (text: string) => defaultMatch(text, /\bnext\b/i),
  },
  SHUFFLE: {
    name: 'SHUFFLE',
    details: 'Indicates to shuffle the fetched tracks',
    permission: PERMISSION.USER,
    usage: ['shuffle', 'shuffled'],
    priority: 0,
    matchText: (text: string) => defaultMatch(text, /\bshuffled?\b/i),
  },
  FAVORITES: {
    name: 'FAVORITES',
    details: 'Indicates to fetch SoundCloud favorites',
    permission: PERMISSION.USER,
    usage: ['favorites'],
    priority: 0,
    matchText: (text: string) => defaultMatch(text, /\bfavorites\b/i),
  },
  TRACKS: {
    name: 'TRACKS',
    details: 'Indicates to fetch SoundCloud tracks',
    permission: PERMISSION.USER,
    usage: ['tracks'],
    priority: 0,
    matchText: (text: string) => defaultMatch(text, /\btracks\b/i),
  },
  TOP: {
    name: 'TOP',
    details: 'Indicates to fetch the range of tracks starting from the beginning in the list',
    permission: PERMISSION.USER,
    usage: [
      'TOP 100  # Get the first 100 songs',
      'TOP 4:10  # Get the 4th song to the 10th song',
      'TOP 5:-5  # Get the 5th song to the 5th last song'
    ],
    priority: 1,
    matchText: (text: string) => {
      const match = defaultMatch(text, /\bTOP\s+((\d+)(:(-?\d+))?)\b/i);
      if (match.matches) match.args = { start: parseInt(match.args[1]), stop: match.args[3] ? parseInt(match.args[3]) : null };
      return match;
    },
  },
  BOTTOM: {
    name: 'BOTTOM',
    details: 'Indicates to fetch the range of tracks starting from the end of the list',
    permission: PERMISSION.USER,
    usage: [
      'BOTTOM 100  # Get the last 100 songs',
      'BOTTOM 4:10  # Get the 4th last song to the 10th last song',
      'BOTTOM 5:-5  # Get the 5th last song to the 5th first song'
    ],
    priority: 1,
    matchText: (text: string) => {
      const match = defaultMatch(text, /\bBOTTOM\s+((\d+)(:(-?\d+))?)\b/i);
      if (match.matches) match.args = { start: parseInt(match.args[1]), stop: match.args[3] ? parseInt(match.args[3]) : null };
      return match;
    },
  },
  ARG: {
    name: 'ARG',
    details: `Used for when keywords just won't cut it.`,
    permission: PERMISSION.USER,
    usage: [
      '/ argument 1 / argument 2 / argument 3 /'
    ],
    priority: 2,
    matchText: (text: string) => {
      const match = defaultMatch(text, /\B\/\s*([^\/]+(\/[^\/]+)*)\/\B/i, 0);
      if (match.matches) match.args = match.args.split(/\s*\/\s*/g);
      return match;
    },
  },
  URL: {
    name: 'URL',
    details: 'Indicates that you may specify a URI to a resource from YouTube, Spotify, or SoundCloud.',
    permission: PERMISSION.USER,
    usage: [
      'https://open.spotify.com/album/3cWA6fj7NEfoGuGRYGxsam?si=cAQnHBD0Q6GO62egKBJmFQ',
      'soundcloud.com/kayfluxx/timbaland-apologize-ft-one-republic-kayfluxx-remix',
      'spotify:album:3cWA6fj7NEfoGuGRYGxsam',
      'https://www.youtube.com/watch?v=FRjOSmc01-M'
    ],
    priority: 3,
    matchText: (text: string) => {
      const match = defaultMatch(text, /\b((https?:\/\/)?[^\s]+\.com(\/[^\s]+)?|spotify:[a-zA-Z]+:[^\s]+)(\b|\B|\$)/, 0);
      if (match.matches) {
        const args = { value: match.args, source: SOURCE.UNKNOWN };
        if (match.args.match(/youtube\.com/g)) args.source = SOURCE.YOUTUBE;
        else if (match.args.match(/soundcloud\.com/g)) args.source = SOURCE.SOUNDCLOUD;
        else if (match.args.match(/(spotify\.com|spotify:.+:)/g)) args.source = SOURCE.SPOTIFY
        match.args = args;
      }
      return match;
    },
  },
  IDENTIFIER: {
    name: 'IDENTIFIER',
    details: 'Used for referring to an identifier (a shortcut) for some resource such as a playlist.',
    permission: PERMISSION.USER,
    usage: ['[my identifier]', '[music playlist #2]'],
    priority: 4,
    matchText: (text: string) => defaultMatch(text, /\B\[\s*([^\s].+[^\s])\s*\]\B/i, 0),
  },
  QUERY: {
    name: 'QUERY',
    details: 'Used for searching.',
    permission: PERMISSION.USER,
    usage: ['(what is love)', '(deadmau5)'],
    priority: 5,
    matchText: (text: string) => defaultMatch(text, /\B\(\s*([^\s].+[^\s])\s*\)\B/i, 0),
  },
};

function defaultMatch(text: string, reg: RegExp, group?: number): { matches: boolean, newText: string, args: any } {
  const regArr = reg.exec(text);
  const match = { matches: !!regArr, newText: text.replace(reg, ''), args: null };
  if (match.matches) {
    if (regArr.length === 1) {
      match.args = true;
    } else {
      match.args = regArr.slice(1).map(group => group ? group.trim() : group);
      if (typeof group === 'number') {
        match.args = match.args[group];
      }
    }
  }
  return match;
};