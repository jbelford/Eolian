import { CommandOptions } from 'commands/@types';
import { ResourceType } from 'data/@types';
import { ContextSendable } from 'framework/@types';
import { SourceFetcher } from 'resolvers/@types';
import { SpotifyAlbumFetcher } from './album';
import { SpotifyArtistFetcher } from './artist';
import { SpotifyPlaylistFetcher } from './playlist';
import { SpotifySongFetcher } from './url';

export { SpotifyAlbumResolver } from './album';
export { SpotifyArtistResolver } from './artist';
export { SpotifyPlaylistResolver } from './playlist';
export { SpotifyUrlResolver } from './url';

export function getSpotifySourceFetcher(
  id: string,
  type: ResourceType,
  params: CommandOptions,
  sendable: ContextSendable
): SourceFetcher {
  switch (type) {
    case ResourceType.Album:
      return new SpotifyAlbumFetcher(id);
    case ResourceType.Artist:
      return new SpotifyArtistFetcher(id);
    case ResourceType.Playlist:
      return new SpotifyPlaylistFetcher(id, params, sendable);
    case ResourceType.Song:
      return new SpotifySongFetcher(id);
    default:
      throw new Error('Invalid type for Spotify fetcher');
  }
}
