interface IKeywords {
  ENABLE: Keyword;
  DISABLE: Keyword;
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
  readonly permission: import('../src/common/constants').PERMISSION;
  readonly usage: string[];
  // Indicates that a match could contain matches of other non-complex keywords
  // As such, any matches should be removed from the text before matching non-complex keywords
  readonly complex?: boolean;

  /**
   * Check that the given text contains the keyword.
   * Removes the keyword information from the text and returns a new string.
   * 
   * @param text
   */
  matchText(text: string): { matches: boolean, newText: string, args: { [x: string]: any } };
}