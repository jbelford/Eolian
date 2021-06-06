import { CommandOptions } from 'commands/@types';
import { IdentifierType } from 'data/@types';
import { ContextTextChannel } from 'eolian/@types';
import { SourceFetcher } from 'resolvers/@types';
import { SoundCloudArtistFetcher } from './artist';
import { SoundCloudFavoritesFetcher } from './likes';
import { SoundCloudPlaylistFetcher } from './playlist';
import { SoundCloudSongFetcher } from './song';

export { SoundCloudArtistResolver, SoundCloudTracksResolver } from './artist';
export { SoundCloudFavoritesResolver } from './likes';
export { SoundCloudPlaylistResolver } from './playlist';
export { SoundCloudSongResolver } from './song';
export { SoundCloudUrlResolver } from './url';

export function getSoundCloudSourceFetcher(id: number,
  type: IdentifierType,
  params: CommandOptions,
  channel: ContextTextChannel): SourceFetcher {
switch (type) {
  case IdentifierType.TRACKS:
  case IdentifierType.ARTIST:
    return new SoundCloudArtistFetcher(id);
  case IdentifierType.LIKES:
    return new SoundCloudFavoritesFetcher(id, params, channel);
  case IdentifierType.PLAYLIST:
    return new SoundCloudPlaylistFetcher(id);
  case IdentifierType.SONG:
    return new SoundCloudSongFetcher(id);
  default:
    throw new Error(`Invalid type for SoundCloud fetcher`);
}
}