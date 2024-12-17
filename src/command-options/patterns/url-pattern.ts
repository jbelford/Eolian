import { TrackSource } from '@eolian/api/@types';
import { UserPermission } from '@eolian/common/constants';
import { Pattern, KeywordGroup, UrlArgument } from '../@types';
import { PassthroughExample, matchGroup } from './patterns-utils';

export const URL_PATTERN: Pattern<'URL'> = {
  name: 'URL',
  details:
    'Indicates that you may specify a URI to a resource from YouTube, Spotify, or SoundCloud.',
  permission: UserPermission.User,
  usage: [
    'https://open.spotify.com/album/3cWA6fj7NEfoGuGRYGxsam?si=cAQnHBD0Q6GO62egKBJmFQ',
    'soundcloud.com/kayfluxx/timbaland-apologize-ft-one-republic-kayfluxx-remix',
    'spotify:album:3cWA6fj7NEfoGuGRYGxsam',
    'https://www.youtube.com/watch?v=FRjOSmc01-M',
  ],
  priority: 4,
  group: KeywordGroup.Search,
  ex: text => new PassthroughExample(URL_PATTERN.group!, text),
  matchText: (text: string) => {
    const match = matchGroup(
      text,
      /\b((https?:\/\/)?[^\s]+\.(com|be)(\/[^\s]+)?|spotify:[a-zA-Z]+:[^\s]+)(\b|\B|\$)/,
      0,
    );
    let args: UrlArgument | undefined;
    if (match.matches && match.args) {
      args = { value: match.args, source: TrackSource.Unknown };
      if (args.value.match(/youtu(be\.com|\.be)/g)) args.source = TrackSource.YouTube;
      else if (args.value.match(/soundcloud\.com/g)) args.source = TrackSource.SoundCloud;
      else if (args.value.match(/(spotify\.com|spotify:.+:)/g)) args.source = TrackSource.Spotify;
    }
    return { matches: match.matches, newText: match.newText, args };
  },
};
