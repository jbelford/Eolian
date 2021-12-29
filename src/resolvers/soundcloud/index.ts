import { CommandOptions } from 'commands/@types';
import { ResourceType } from 'data/@types';
import { ContextSendable } from 'framework/@types';
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
  type: ResourceType,
  params: CommandOptions,
  sendable: ContextSendable): SourceFetcher {
switch (type) {
  case ResourceType.Tracks:
  case ResourceType.Artist:
    return new SoundCloudArtistFetcher(id);
  case ResourceType.Likes:
    return new SoundCloudFavoritesFetcher(id, params, sendable);
  case ResourceType.Playlist:
    return new SoundCloudPlaylistFetcher(id);
  case ResourceType.Song:
    return new SoundCloudSongFetcher(id);
  default:
    throw new Error(`Invalid type for SoundCloud fetcher`);
}
}