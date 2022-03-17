import { UserPermission } from 'common/constants';
import { Keyword, KeywordGroup, KeywordGroupProperties, KeywordName, SyntaxType } from './@types';

export const KEYWORD_GROUPS: Readonly<Record<KeywordGroup, KeywordGroupProperties>> = {
  increment: {
    details: 'Indicates to increment or decrement a value.',
  },
  source: {
    details: 'Select which supported service to fetch from.',
  },
  switch: {
    details: 'Whether to enable or disable.',
  },
  type: {
    details: 'Which type of resource to fetch.',
  },
  search: {
    details: 'Input either a URL or search terms.',
  },
};

class KeywordDetails implements Keyword {

  constructor(
    readonly name: KeywordName,
    readonly details: string,
    readonly permission: UserPermission,
    readonly group?: KeywordGroup,
    readonly shortName?: string
  ) {}

  text(type: SyntaxType, short?: boolean): string {
    switch (type) {
      case SyntaxType.KEYWORD:
        return short ? this.shortName!.toLowerCase() : this.name.toLowerCase();
      case SyntaxType.TRADITIONAL:
        return '-' + (short ? this.shortName!.toLowerCase() : this.name.toLowerCase());
      case SyntaxType.SLASH:
        return this.group
          ? `${this.group}:${this.name.toLowerCase()}`
          : `${this.name.toLowerCase()}:True`;
      default:
        throw new Error(`Unknown syntax type '${type}'!`);
    }
  }

}

export const KEYWORDS: Readonly<
  Record<string, Keyword | undefined> & Record<KeywordName, Keyword>
> = {
  ENABLE: new KeywordDetails(
    'ENABLE',
    'Indicates to enable a particular feature.',
    UserPermission.User,
    KeywordGroup.Switch,
    'on'
  ),
  DISABLE: new KeywordDetails(
    'DISABLE',
    'Indicates to disable a particular feature.',
    UserPermission.User,
    KeywordGroup.Switch,
    'off'
  ),
  CLEAR: new KeywordDetails('CLEAR', 'Indicates to remove some data.', UserPermission.User),
  MORE: new KeywordDetails(
    'MORE',
    'Indicates to increase a value.',
    UserPermission.User,
    KeywordGroup.Increment,
    'inc'
  ),
  LESS: new KeywordDetails(
    'LESS',
    'Indicates to decrease a value.',
    UserPermission.User,
    KeywordGroup.Increment,
    'dec'
  ),
  MY: new KeywordDetails(
    'MY',
    'Indicates to fetch information from your account. Be it SoundCloud or Spotify.',
    UserPermission.User
  ),
  SOUNDCLOUD: new KeywordDetails(
    'SOUNDCLOUD',
    'Indicates to fetch a resource from SoundCloud if applicable.',
    UserPermission.User,
    KeywordGroup.Source,
    'sc'
  ),
  SPOTIFY: new KeywordDetails(
    'SPOTIFY',
    'Indicates to fetch a resource from Spotify if applicable.',
    UserPermission.User,
    KeywordGroup.Source,
    'sp'
  ),
  YOUTUBE: new KeywordDetails(
    'YOUTUBE',
    'Indicates to fetch a resource from YouTube if applicable.',
    UserPermission.User,
    KeywordGroup.Source,
    'yt'
  ),
  PLAYLIST: new KeywordDetails(
    'PLAYLIST',
    'Indicates to fetch songs from a playlist given a query.',
    UserPermission.User,
    KeywordGroup.Type,
    'pl'
  ),
  ALBUM: new KeywordDetails(
    'ALBUM',
    'Indicates to fetch songs from an album given a query.',
    UserPermission.User,
    KeywordGroup.Type,
    'alb'
  ),
  ARTIST: new KeywordDetails(
    'ARTIST',
    'Indicates to fetch songs for an artist given the query.',
    UserPermission.User,
    KeywordGroup.Type,
    'art'
  ),
  NEXT: new KeywordDetails(
    'NEXT',
    'Indicates to apply operation to the top of queue.',
    UserPermission.DJ,
    undefined,
    'n'
  ),
  SHUFFLE: new KeywordDetails(
    'SHUFFLE',
    'Indicates to shuffle the fetched tracks.',
    UserPermission.User,
    undefined,
    'shfl'
  ),
  LIKES: new KeywordDetails(
    'LIKES',
    'Indicates to fetch liked tracks.\nFetching using TOP likes will execute much faster.',
    UserPermission.User,
    KeywordGroup.Type
  ),
  TRACKS: new KeywordDetails(
    'TRACKS',
    'Indicates to fetch SoundCloud tracks or Spotify top tracks.',
    UserPermission.User,
    KeywordGroup.Type
  ),
  FAST: new KeywordDetails(
    'FAST',
    'Select the first result if multiple options',
    UserPermission.User,
    undefined,
    'f'
  ),
};

export const KEYWORDS_MAPPED = Object.values(KEYWORDS)
  .filter(keyword => keyword)
  .reduce<Record<string, Keyword>>((obj, keyword) => {
    obj[keyword!.name] = keyword!;
    if (keyword!.shortName) {
      obj[keyword!.shortName.toUpperCase()] = keyword!;
    }
    return obj;
  }, {});
