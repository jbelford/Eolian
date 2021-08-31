import { CommandOptions } from 'commands/@types';
import { IdentifierType } from 'data/@types';
import { ContextTextChannel } from 'framework/@types';
import { SourceFetcher } from 'resolvers/@types';
import { SpotifyAlbumFetcher } from './album';
import { SpotifyArtistFetcher } from './artist';
import { SpotifyPlaylistFetcher } from './playlist';
import { SpotifySongFetcher } from './url';

export { SpotifyAlbumResolver } from './album';
export { SpotifyArtistResolver } from './artist';
export { SpotifyPlaylistResolver } from './playlist';
export { SpotifyUrlResolver } from './url';

export function getSpotifySourceFetcher(id: string,
  type: IdentifierType,
  params: CommandOptions,
  channel: ContextTextChannel): SourceFetcher {

  switch (type) {
    case IdentifierType.ALBUM:
      return new SpotifyAlbumFetcher(id);
    case IdentifierType.ARTIST:
      return new SpotifyArtistFetcher(id);
    case IdentifierType.PLAYLIST:
      return new SpotifyPlaylistFetcher(id, params, channel);
    case IdentifierType.SONG:
      return new SpotifySongFetcher(id);
    default:
      throw new Error('Invalid type for Spotify fetcher');
  }
}