import { spotify } from 'api';
import { SpotifyAlbum, SpotifyAlbumFull } from 'api/@types';
import { mapSpotifyTrack } from 'api/spotify';
import { CommandContext, CommandOptions } from 'commands/@types';
import { MESSAGES, SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { IdentifierType } from 'data/@types';
import { SelectionOption } from 'embed/@types';
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
    const idx = await this.context.interaction.channel.sendSelection(
      `Select the album you want (resolved via Spotify)`, options, this.context.interaction.user);
    if (idx < 0) {
      throw new EolianUserError(MESSAGES.NO_SELECTION);
    }

    const album = albums[idx];
    return createSpotifyAlbum(album);
  }
}

export function createSpotifyAlbum(album: SpotifyAlbum): ResolvedResource {
  return {
    name: album.name,
    authors: album.artists.map(x => x.name),
    identifier: {
      id: album.id,
      src: SOURCE.SPOTIFY,
      type: IdentifierType.ALBUM,
      url: album.external_urls.spotify
    },
    fetcher: new SpotifyAlbumFetcher(album.id, album)
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