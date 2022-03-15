import { mapSpotifyTrack, spotify } from 'api';
import { TrackSource } from 'api/@types';
import { SpotifyAlbum, SpotifyAlbumFull } from 'api/spotify/@types';
import { CommandContext, CommandOptions } from 'commands/@types';
import { EolianUserError } from 'common/errors';
import { ResourceType } from 'data/@types';
import { SelectionOption } from 'embed/@types';
import { ContextMessage } from 'framework/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';

export class SpotifyAlbumResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {}

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('Missing search query for album.');
    }

    const albums = await spotify.searchAlbums(this.params.SEARCH, this.params.FAST ? 1 : 5);
    if (albums.length === 0) {
      throw new EolianUserError('No Spotify albums were found.');
    } else if (albums.length === 1) {
      return createSpotifyAlbum(albums[0]);
    } else {
      const options: SelectionOption[] = albums.map(album => ({
        name: album.name,
        subname: album.artists.map(artist => artist.name).join(','),
        url: album.external_urls.spotify,
      }));
      const result = await this.context.interaction.sendSelection(
        `Select the album you want (resolved via Spotify)`,
        options,
        this.context.interaction.user
      );

      return createSpotifyAlbum(albums[result.selected], result.message);
    }
  }

}

export function createSpotifyAlbum(
  album: SpotifyAlbum,
  message?: ContextMessage
): ResolvedResource {
  return {
    name: album.name,
    authors: album.artists.map(x => x.name),
    identifier: {
      id: album.id,
      src: TrackSource.Spotify,
      type: ResourceType.Album,
      url: album.external_urls.spotify,
    },
    fetcher: new SpotifyAlbumFetcher(album.id, album),
    selectionMessage: message,
  };
}

export class SpotifyAlbumFetcher implements SourceFetcher {

  constructor(private readonly id: string, private readonly album?: SpotifyAlbum) {}

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
