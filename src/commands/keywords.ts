import { AbsRangeArgument, RangeArgument } from 'common/@types';
import { PERMISSION, SOURCE } from 'common/constants';
import { convertRangeToAbsolute } from 'common/util';
import { ArgumentExample, CommandOptions, Keyword, KeywordMatchResult, Keywords, Patterns, SyntaxType, UrlArgument } from './@types';

class KeywordDetails implements Keyword {

  constructor(
    readonly name: string,
    readonly details: string,
    readonly permission: PERMISSION
  ) {
  }

  text(type: SyntaxType): string {
    return type === SyntaxType.KEYWORD ? this.name.toLowerCase() : `-${this.name.toLowerCase()}`;
  }

}

export const KEYWORDS: Keywords = {
  ENABLE: new KeywordDetails('ENABLE', 'Indicates to enable a particular feature', PERMISSION.USER),
  DISABLE: new KeywordDetails('DISABLE', 'Indicates to disable a particular feature', PERMISSION.USER),
  CLEAR: new KeywordDetails('CLEAR', 'Indicates to remove some data', PERMISSION.USER),
  MORE: new KeywordDetails('MORE', 'Indicates to increase a value', PERMISSION.USER),
  LESS: new KeywordDetails('LESS', 'Indicates to decrease a value', PERMISSION.USER),
  MY: new KeywordDetails('MY', 'Indicates to fetch information from your account. Be it SoundCloud or Spotify.', PERMISSION.USER),
  SOUNDCLOUD: new KeywordDetails('SOUNDCLOUD', 'Indicates to fetch a resource from SoundCloud if applicable', PERMISSION.USER),
  SPOTIFY: new KeywordDetails('SPOTIFY', 'Indicates to fetch a resource from Spotify if applicable', PERMISSION.USER),
  YOUTUBE: new KeywordDetails('YOUTUBE', 'Indicates to fetch a resource from YouTube if applicable', PERMISSION.USER),
  PLAYLIST: new KeywordDetails('PLAYLIST', 'Indicates to fetch songs from a playlist given a query', PERMISSION.USER),
  ALBUM: new KeywordDetails('ALBUM', 'Indicates to fetch songs from an album given a query', PERMISSION.USER),
  ARTIST: new KeywordDetails('ARTIST', 'Indicates to fetch songs for an artist given the query', PERMISSION.USER),
  NEXT: new KeywordDetails('NEXT', 'Indicates to apply operation to the top of queue', PERMISSION.USER),
  SHUFFLE: new KeywordDetails('SHUFFLE', 'Indicates to shuffle the fetched tracks', PERMISSION.USER),
  LIKES: new KeywordDetails('LIKES', 'Indicates to fetch liked tracks (Only SoundCloud supported).\nFetching using TOP likes will execute much faster.', PERMISSION.USER),
  TRACKS: new KeywordDetails('TRACKS', 'Indicates to fetch SoundCloud tracks', PERMISSION.USER)
};

export const PATTERNS: Patterns = {
  NUMBER: {
    name: 'NUMBER',
    details: 'Indicates to specify a number',
    permission: PERMISSION.USER,
    usage: [
      '50',
      '0.5',
      '-100',
      '10 11'
    ],
    ex: text => new PassthroughExample(text),
    priority: 1,
    matchText: (text: string) => {
      const match = matchAll(text, /(?<=\s|^)(-?\d+(\.\d+)?)(?=\s|$)/g, 0);
      return { matches: match.matches, newText: match.newText, args: match.args ? match.args.map(a => +a) : undefined };
    },
  },
  TOP: {
    name: 'TOP',
    details: 'Indicates to fetch the range of tracks starting from the beginning in the list',
    permission: PERMISSION.USER,
    usage: [
      '100  # Get the first 100 songs',
      '4:10  # Get the 4th song to the 10th song',
      '5:-5  # Get the 5th song to the 5th last song'
    ],
    priority: 2,
    ex: text => new RangeExample(text, 'top'),
    matchText: (text, type) => {
      const reg = type === SyntaxType.KEYWORD ? /(^|\s)TOP\s+((\d+)(:(-?\d+))?)/i : /(^|\s)-TOP\s+((\d+)(:(-?\d+))?)/i;
      const match = matchText(text, reg);
      let args: RangeArgument | undefined;
      if (match.matches && match.args && match.args.length >= 5) {
        args = { start: +match.args[2] };
        if (match.args[3]) args.stop = +match.args[4];
      }
      return { matches: match.matches, newText: match.newText, args };
    },
  },
  BOTTOM: {
    name: 'BOTTOM',
    details: 'Indicates to fetch the range of tracks starting from the end of the list',
    permission: PERMISSION.USER,
    usage: [
      '100  # Get the last 100 songs',
      '4:10  # Get the 4th last song to the 10th last song',
      '5:-5  # Get the 5th last song to the 5th first song'
    ],
    priority: 2,
    ex: text => new RangeExample(text, 'bottom'),
    matchText: (text, type) => {
      const reg = type === SyntaxType.KEYWORD ? /(^|\s)BOTTOM\s+((\d+)(:(-?\d+))?)/i : /(^|\s)-BOTTOM\s+((\d+)(:(-?\d+))?)/i;
      const match = matchText(text, reg);
      let args: RangeArgument | undefined;
      if (match.matches && match.args && match.args.length >= 5) {
        args = { start: +match.args[2] };
        if (match.args[3]) args.stop = +match.args[4];
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
    priority: 3,
    ex: text => new PassthroughExample(text),
    matchText: (text: string) => {
      const match = matchGroup(text, /\B\/\s*([^/]+(\/[^/]+)*)\/\B/, 0);
      return { matches: match.matches, newText: match.newText, args: match.args?.split(/\s*\/\s*/g) };
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
    priority: 4,
    ex: text => new PassthroughExample(text),
    matchText: (text: string) => {
      const match = matchGroup(text, /\b((https?:\/\/)?[^\s]+\.(com|be)(\/[^\s]+)?|spotify:[a-zA-Z]+:[^\s]+)(\b|\B|\$)/, 0);
      let args: UrlArgument | undefined;
      if (match.matches && match.args) {
        args = { value: match.args, source: SOURCE.UNKNOWN };
        if (args.value.match(/youtu(be\.com|\.be)/g)) args.source = SOURCE.YOUTUBE;
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
    priority: 5,
    ex: text => new PassthroughExample(text),
    matchText: (text: string) => matchGroup(text, /\B\[\s*(.*[^\s])\s*\]\B/i, 0),
  },
  SEARCH: {
    name: 'SEARCH',
    details: 'Used for searching.',
    permission: PERMISSION.USER,
    usage: ['what is love', 'deadmau5'],
    priority: 6,
    ex: text => new SearchExample(text),
    matchText: (text: string) => matchGroup(text, /\B\(\s*(.*[^\s])\s*\)\B/i, 0),
  }
};

export const PATTERNS_SORTED = Object.values(PATTERNS)
  .sort((a, b) => b!.priority - a!.priority);

function matchText(text: string, reg: RegExp): KeywordMatchResult<string[]> {
  const regArr = reg.exec(text);
  const match: KeywordMatchResult<string[]> = { matches: !!regArr, newText: text.replace(reg, '') };
  if (regArr) {
    match.args = regArr.slice(1).map(group => group && group.trim());
  }
  return match;
}

function matchAll(text: string, reg: RegExp, group: number): KeywordMatchResult<string[]> {
  const matches = text.matchAll(reg);
  const result: KeywordMatchResult<string[]> = { matches: false, newText: text, args: [] };
  for (const match of matches) {
    result.matches = true;
    result.newText = result.newText.replace(match[0], '');
    result.args!.push(match[group + 1]);
  }
  return result;
}

function matchGroup(text: string, reg: RegExp, group: number): KeywordMatchResult<string> {
  const match = matchText(text, reg);
  let args: string | undefined;
  if (match.matches && match.args) {
    args = match.args[group];
    if (reg.ignoreCase) {
      args = args.toLowerCase();
    }
  }
  return { matches: match.matches, newText: match.newText, args };
}

class PassthroughExample implements ArgumentExample {

  constructor(private readonly _text: string) {
  }

  text(): string {
    return this._text;
  }

}

class SearchExample implements ArgumentExample {

  constructor(private readonly _text: string) {
  }

  text(type: SyntaxType): string {
    return type === SyntaxType.KEYWORD ? `(${this._text})` : this._text;
  }

}

class RangeExample implements ArgumentExample {

  constructor(private readonly _text: string, private readonly name: string) {
  }

  text(type: SyntaxType): string {
    return type === SyntaxType.KEYWORD ? `${this.name} ${this._text}` : `-${this.name} ${this._text}`;
  }

}


export function getRangeOption(options: CommandOptions, total: number): AbsRangeArgument | undefined {
  let range: AbsRangeArgument | undefined;
  if (options.TOP) {
    range = convertRangeToAbsolute(options.TOP, total);
  } else if (options.BOTTOM) {
    range = convertRangeToAbsolute(options.BOTTOM, total, true);
  }
  return range;
}
