interface IKeywords {
  [key: string]: Keyword<unknown> | undefined;
  ENABLE: Keyword<boolean>;
  DISABLE: Keyword<boolean>;
  CLEAR: Keyword<boolean>;
  MORE: Keyword<boolean>;
  LESS: Keyword<boolean>;
  MY: Keyword<boolean>;
  SOUNDCLOUD: Keyword<boolean>;
  SPOTIFY: Keyword<boolean>;
  YOUTUBE: Keyword<boolean>;
  PLAYLIST: Keyword<boolean>;
  ALBUM: Keyword<boolean>;
  ARTIST: Keyword<boolean>;
  NEXT: Keyword<boolean>;
  SHUFFLE: Keyword<boolean>;
  FAVORITES: Keyword<boolean>;
  TRACKS: Keyword<boolean>;
  TOP: Keyword<IRangeParam>;
  BOTTOM: Keyword<IRangeParam>;
  QUERY: Keyword<string>;
  IDENTIFIER: Keyword<string>;
  URL: Keyword<IUrlParam>;
  ARG: Keyword<string[]>;
}


interface IRangeParam {
  start: number;
  stop?: number;
}

interface IUrlParam {
  value: string;
  source: import('common/constants').SOURCE;
}

interface KeywordMatchResult<T> {
  matches: boolean;
  newText: string;
  args?: T;
}

type Keyword<T> = {
  readonly name: string;
  readonly details: string;
  readonly permission: import('common/constants').PERMISSION;
  readonly usage: string[];
  // Higher priority means that this keyword should be parsed and removed from the text before others.
  readonly priority: number;

  /**
   * Check that the given text contains the keyword.
   * Removes the keyword information from the text and returns a new string.
   *
   * @param text
   */
  matchText(text: string): KeywordMatchResult<T>;
}