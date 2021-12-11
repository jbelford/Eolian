import { spotify } from 'api';
import { SpotifyAlbum, SpotifyAlbumFull } from 'api/@types';
import { mapSpotifyTrack } from 'api/spotify';
import { CommandContext, CommandOptions } from 'commands/@types';
import { SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { IdentifierType } from 'data/@types';
import { SelectionOption } from 'embed/@types';
import { ContextMessage } from 'framework/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';


export class SpotifyAlbumResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('Missing search query for album.');
    }

    const albums = await spotify.searchAlbums(this.params.SEARCH);

    const options: SelectionOption[] = albums.map(album => ({
      name: album.name,
      subname: album.artists.map(artist => artist.name).join(','),
      url: album.external_urls.spotify
    }));
    const result = await this.context.interaction.sendSelection(
      `Select the album you want (resolved via Spotify)`, options, this.context.interaction.user);

    return createSpotifyAlbum(albums[result.selected], result.message);
  }
}

export function createSpotifyAlbum(album: SpotifyAlbum, message?: ContextMessage): ResolvedResource {
  return {
    name: album.name,
    authors: album.artists.map(x => x.name),
    identifier: {
      id: album.id,
      src: SOURCE.SPOTIFY,
      type: IdentifierType.ALBUM,
      url: album.external_urls.spotify
    },
    fetcher: new SpotifyAlbumFetcher(album.id, album),
    selectionMessage: message
  };
}

export class SpotifyAlbumFetcher implements SourceFetcher {

  constructor(private readonly id: string,
    private readonly album?: SpotifyAlbum) {
  }

  async fetch(): Promise<FetchResult> {
    let album: SpotifyAlbumFull;
    if (this.album?.tracks && this.album.tracks.items?.length === this.album.tracks.total) {
      album = this.album as SpotifyAlbumFull;
    } else {
      album = await spotify.getAlbumTracks(this.id);
    }

    const artwork = album.images.length ? album.images[0].url : undefined;
    const tracks = album.tracks.items.map(track => mapSpotifyTrack(track, artwork));
    return { tracks };
  }

}