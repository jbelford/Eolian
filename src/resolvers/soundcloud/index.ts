import { CommandContext, CommandOptions } from 'commands/@types';
import { Identifier, ResourceType } from 'data/@types';
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

export function getSoundCloudSourceFetcher(
  identifier: Identifier,
  context: CommandContext,
  params: CommandOptions
): SourceFetcher {
  const id = +identifier.id;
  switch (identifier.type) {
    case ResourceType.Tracks:
    case ResourceType.Artist:
      return new SoundCloudArtistFetcher(id);
    case ResourceType.Likes:
      return new SoundCloudFavoritesFetcher(id, params, context.interaction);
    case ResourceType.Playlist:
      return new SoundCloudPlaylistFetcher(id);
    case ResourceType.Song:
      return new SoundCloudSongFetcher(id);
    default:
      throw new Error(`Invalid type for SoundCloud fetcher`);
  }
}
