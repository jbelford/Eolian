import { PERMISSION } from 'common/constants';
import { Keyword, KeywordGroup, KeywordGroupProperties, KeywordName, SyntaxType } from './@types';

export const KEYWORD_GROUPS: Readonly<Record<KeywordGroup, KeywordGroupProperties>> = {
  increment: {
    details: 'Indicates to increment or decrement a value.'
  },
  source: {
    details: 'Select which supported service to fetch from.'
  },
  switch: {
    details: 'Whether to enable or disable.'
  },
  type: {
    details: 'Which type of resource to fetch.'
  },
  input: {
    details: 'Input either a URL or search terms.'
  }
};

class KeywordDetails implements Keyword {

  constructor(
    readonly name: KeywordName,
    readonly details: string,
    readonly permission: PERMISSION,
    readonly group?: KeywordGroup
  ) {
  }

  text(type: SyntaxType): string {
    return type === SyntaxType.KEYWORD ? this.name.toLowerCase() : `-${this.name.toLowerCase()}`;
  }

}

export const KEYWORDS: Readonly<Record<string, Keyword | undefined> & Record<KeywordName, Keyword>> = {
  ENABLE: new KeywordDetails('ENABLE', 'Indicates to enable a particular feature.', PERMISSION.USER, KeywordGroup.Switch),
  DISABLE: new KeywordDetails('DISABLE', 'Indicates to disable a particular feature.', PERMISSION.USER, KeywordGroup.Switch),
  CLEAR: new KeywordDetails('CLEAR', 'Indicates to remove some data.', PERMISSION.USER),
  MORE: new KeywordDetails('MORE', 'Indicates to increase a value.', PERMISSION.USER, KeywordGroup.Increment),
  LESS: new KeywordDetails('LESS', 'Indicates to decrease a value.', PERMISSION.USER, KeywordGroup.Increment),
  MY: new KeywordDetails('MY', 'Indicates to fetch information from your account. Be it SoundCloud or Spotify.', PERMISSION.USER),
  SOUNDCLOUD: new KeywordDetails('SOUNDCLOUD', 'Indicates to fetch a resource from SoundCloud if applicable.', PERMISSION.USER, KeywordGroup.Source),
  SPOTIFY: new KeywordDetails('SPOTIFY', 'Indicates to fetch a resource from Spotify if applicable.', PERMISSION.USER, KeywordGroup.Source),
  YOUTUBE: new KeywordDetails('YOUTUBE', 'Indicates to fetch a resource from YouTube if applicable.', PERMISSION.USER, KeywordGroup.Source),
  PLAYLIST: new KeywordDetails('PLAYLIST', 'Indicates to fetch songs from a playlist given a query.', PERMISSION.USER, KeywordGroup.Type),
  ALBUM: new KeywordDetails('ALBUM', 'Indicates to fetch songs from an album given a query.', PERMISSION.USER, KeywordGroup.Type),
  ARTIST: new KeywordDetails('ARTIST', 'Indicates to fetch songs for an artist given the query.', PERMISSION.USER, KeywordGroup.Type),
  NEXT: new KeywordDetails('NEXT', 'Indicates to apply operation to the top of queue.', PERMISSION.DJ),
  SHUFFLE: new KeywordDetails('SHUFFLE', 'Indicates to shuffle the fetched tracks.', PERMISSION.USER),
  LIKES: new KeywordDetails('LIKES', 'Indicates to fetch liked tracks (Only SoundCloud supported).\nFetching using TOP likes will execute much faster.', PERMISSION.USER, KeywordGroup.Type),
  TRACKS: new KeywordDetails('TRACKS', 'Indicates to fetch SoundCloud tracks.', PERMISSION.USER, KeywordGroup.Type)
};
