import { RangeArgument } from 'common/@types';
import { PERMISSION, SOURCE } from 'common/constants';
import { KeywordMatchResult, Keywords, UrlArgument } from './@types';

export const KEYWORDS: Keywords = {
  ENABLE: {
    name: 'ENABLE',
    details: 'Indicates to enable a particular feature',
    permission: PERMISSION.OWNER,
    usage: ['enable'],
    priority: 0,
    matchText: (text: string) => simpleMatch(text, /\benable\b/i),
  },
  DISABLE: {
    name: 'DISABLE',
    details: 'Indicates to disable a particular feature',
    permission: PERMISSION.OWNER,
    usage: ['disable'],
    priority: 0,
    matchText: (text: string) => simpleMatch(text, /\bdisable\b/i),
  },
  CLEAR: {
    name: 'CLEAR',
    details: 'Indicates to remove some data',
    permission: PERMISSION.USER,
    usage: ['clear'],
    priority: 0,
    matchText: (text: string) => simpleMatch(text, /\bclear\b/i),
  },
  MORE: {
    name: 'MORE',
    details: 'Indicates to increase a value',
    permission: PERMISSION.USER,
    usage: ['more'],
    priority: 0,
    matchText: (text: string) => simpleMatch(text, /\bmore\b/i),
  },
  LESS: {
    name: 'LESS',
    details: 'Indicates to decrease a value',
    permission: PERMISSION.USER,
    usage: ['less'],
    priority: 0,
    matchText: (text: string) => simpleMatch(text, /\bless\b/i),
  },
  MY: {
    name: 'MY',
    details: 'Indicates to fetch information from your account. Be it SoundCloud or Spotify.',
    permission: PERMISSION.USER,
    usage: ['my'],
    priority: 0,
    matchText: (text: string) => simpleMatch(text, /\bmy\b/i)
  },
  SOUNDCLOUD: {
    name: 'SOUNDCLOUD',
    details: 'Indicates to fetch a resource from SoundCloud if applicable',
    permission: PERMISSION.USER,
    usage: ['soundcloud'],
    priority: 0,
    matchText: (text: string) => simpleMatch(text, /\bsoundcloud\b/i),
  },
  SPOTIFY: {
    name: 'SPOTIFY',
    details: 'Indicates to fetch a resource from Spotify if applicable',
    permission: PERMISSION.USER,
    usage: ['spotify'],
    priority: 0,
    matchText: (text: string) => simpleMatch(text, /\bspotify\b/i),
  },
  YOUTUBE: {
    name: 'YOUTUBE',
    details: 'Indicates to fetch a resource from YouTube if applicable',
    permission: PERMISSION.USER,
    usage: ['youtube'],
    priority: 0,
    matchText: (text: string) => simpleMatch(text, /\byoutube\b/i),
  },
  PLAYLIST: {
    name: 'PLAYLIST',
    details: 'Indicates to fetch songs from a playlist given a query',
    permission: PERMISSION.USER,
    usage: ['playlist'],
    priority: 0,
    matchText: (text: string) => simpleMatch(text, /\bplaylist\b/i),
  },
  ALBUM: {
    name: 'ALBUM',
    details: 'Indicates to fetch songs from an album given a query',
    permission: PERMISSION.USER,
    usage: ['album'],
    priority: 0,
    matchText: (text: string) => simpleMatch(text, /\balbum\b/i),
  },
  ARTIST: {
    name: 'ARTIST',
    details: 'Indicates to fetch songs for an artist given the query',
    permission: PERMISSION.USER,
    usage: ['artist'],
    priority: 0,
    matchText: (text: string) => simpleMatch(text, /\bartist\b/i),
  },
  NEXT: {
    name: 'NEXT',
    details: 'Indicates to place fetched tracks at the top of the queue',
    permission: PERMISSION.USER,
    usage: ['next'],
    priority: 0,
    matchText: (text: string) => simpleMatch(text, /\bnext\b/i),
  },
  SHUFFLE: {
    name: 'SHUFFLE',
    details: 'Indicates to shuffle the fetched tracks',
    permission: PERMISSION.USER,
    usage: ['shuffle', 'shuffled'],
    priority: 0,
    matchText: (text: string) => simpleMatch(text, /\bshuffled?\b/i),
  },
  FAVORITES: {
    name: 'FAVORITES',
    details: `Indicates to fetch SoundCloud favorites.
Fetching using TOP likes will execute much faster.`,
    permission: PERMISSION.USER,
    usage: ['favorites'],
    priority: 0,
    matchText: (text: string) => simpleMatch(text, /\bfavorites\b/i),
  },
  TRACKS: {
    name: 'TRACKS',
    details: 'Indicates to fetch SoundCloud tracks',
    permission: PERMISSION.USER,
    usage: ['tracks'],
    priority: 0,
    matchText: (text: string) => simpleMatch(text, /\btracks\b/i),
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
      const match = matchText(text, /\TOP\s+((\d+)(:(-?\d+))?)\b/i);
      let args: RangeArgument | undefined;
      if (match.matches) {
        args = { start: +match.args![1] };
        if (match.args![3]) args.stop = +match.args![3];
      }
      return { matches: match.matches, newText: match.newText, args };
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
      const match = matchText(text, /\bBOTTOM\s+((\d+)(:(-?\d+))?)\b/i);
      let args: RangeArgument | undefined;
      if (match.matches) {
        args = { start: +match.args![1] };
        if (match.args![3]) args.stop = +match.args![3];
      }
      return { matches: match.matches, newText: match.newText, args };
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
      const match = matchGroup(text, /\B\/\s*([^\/]+(\/[^\/]+)*)\/\B/i, 0);
      return { matches: match.matches, newText: match.newText, args: match.matches ? match.args!.split(/\s*\/\s*/g) : undefined};
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
      const match = matchGroup(text, /\b((https?:\/\/)?[^\s]+\.com(\/[^\s]+)?|spotify:[a-zA-Z]+:[^\s]+)(\b|\B|\$)/, 0);
      let args: UrlArgument | undefined;
      if (match.matches) {
        args = { value: match.args!, source: SOURCE.UNKNOWN };
        if (args.value.match(/youtube\.com/g)) args.source = SOURCE.YOUTUBE;
        else if (args.value.match(/soundcloud\.com/g)) args.source = SOURCE.SOUNDCLOUD;
        else if (args.value.match(/(spotify\.com|spotify:.+:)/g)) args.source = SOURCE.SPOTIFY
      }
      return { matches: match.matches, newText: match.newText, args };
    },
  },
  IDENTIFIER: {
    name: 'IDENTIFIER',
    details: 'Used for referring to an identifier (a shortcut) for some resource such as a playlist.',
    permission: PERMISSION.USER,
    usage: ['[my identifier]', '[music playlist #2]'],
    priority: 4,
    matchText: (text: string) => matchGroup(text, /\B\[\s*(.*[^\s])\s*\]\B/i, 0),
  },
  QUERY: {
    name: 'QUERY',
    details: 'Used for searching.',
    permission: PERMISSION.USER,
    usage: ['(what is love)', '(deadmau5)'],
    priority: 5,
    matchText: (text: string) => matchGroup(text, /\B\(\s*([^\s].+[^\s])\s*\)\B/i, 0),
  },
};

function matchText(text: string, reg: RegExp): KeywordMatchResult<string[]> {
  const regArr = reg.exec(text);
  const match: KeywordMatchResult<string[]> = { matches: !!regArr, newText: text.replace(reg, '') };
  if (!!regArr) {
    match.args = regArr.slice(1).map(group => group && group.trim());
  }
  return match;
};

function matchGroup(text: string, reg: RegExp, group: number): KeywordMatchResult<string> {
  const match = matchText(text, reg);
  return { matches: match.matches, newText: match.newText, args: match.matches ? match.args![group] : undefined };
}

function simpleMatch(text: string, reg: RegExp): KeywordMatchResult<boolean> {
  const match = matchText(text, reg);
  return { matches: match.matches, newText: match.newText, args: !!match.args };
}