interface IKeywords {
  ENABLE: Keyword;
  DISABLE: Keyword;
  CLEAR: Keyword;
  MORE: Keyword;
  LESS: Keyword;
  MY: Keyword;
  SOUNDCLOUD: Keyword;
  SPOTIFY: Keyword;
  YOUTUBE: Keyword;
  PLAYLIST: Keyword;
  ALBUM: Keyword;
  ARTIST: Keyword;
  NEXT: Keyword;
  SHUFFLE: Keyword;
  FAVORITES: Keyword;
  TRACKS: Keyword;
  TOP: Keyword;
  BOTTOM: Keyword;
  QUERY: Keyword;
  IDENTIFIER: Keyword;
  URL: Keyword;
  ARG: Keyword;
}

type Keyword = {
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
  matchText(text: string): { matches: boolean, newText: string, args: { [x: string]: any } };
}