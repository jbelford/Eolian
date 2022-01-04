import { spotify } from 'api';
import { SpotifyResourceType, SpotifyTrack, TrackSource } from 'api/@types';
import { mapSpotifyTrack } from 'api/spotify';
import { CommandOptions } from 'commands/@types';
import { EolianUserError } from 'common/errors';
import { ResourceType } from 'data/@types';
import { ContextSendable } from 'framework/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';
import { createSpotifyAlbum } from './album';
import { createSpotifyArtist } from './artist';
import { createSpotifyPlaylist } from './playlist';

export class SpotifyUrlResolver implements SourceResolver {

  constructor(
    private readonly url: string,
    private readonly params: CommandOptions,
    private readonly sendable: ContextSendable
  ) {}

  async resolve(): Promise<ResolvedResource> {
    const resourceDetails = spotify.resolve(this.url);
    if (resourceDetails) {
      switch (resourceDetails.type) {
        case SpotifyResourceType.PLAYLIST: {
          const playlist = await spotify.getPlaylist(resourceDetails.id);
          return createSpotifyPlaylist(playlist, this.params, this.sendable);
        }
        case SpotifyResourceType.ALBUM: {
          const album = await spotify.getAlbum(resourceDetails.id);
          return createSpotifyAlbum(album);
        }
        case SpotifyResourceType.ARTIST: {
          const artist = await spotify.getArtist(resourceDetails.id);
          return createSpotifyArtist(artist);
        }
        case SpotifyResourceType.TRACK: {
          const track = await spotify.getTrack(resourceDetails.id);
          if (track.is_local) {
            throw new EolianUserError(`Local Spotify tracks are not valid for this operation`);
          }
          return createSpotifyTrack(track);
        }
        case SpotifyResourceType.USER: {
          throw new EolianUserError(`Spotify user URLs are not valid for this operation`);
        }
        default:
      }
    }
    throw new EolianUserError('The Spotify URL is not valid!');
  }

}

function createSpotifyTrack(track: SpotifyTrack): ResolvedResource {
  return {
    name: track.name,
    authors: track.artists.map(artist => artist.name),
    identifier: {
      id: track.id!,
      src: TrackSource.Spotify,
      type: ResourceType.Song,
      url: track.external_urls.spotify,
    },
    fetcher: new SpotifySongFetcher(track.id!, track),
  };
}

export class SpotifySongFetcher implements SourceFetcher {

  constructor(private readonly id: string, private readonly track?: SpotifyTrack) {}

  async fetch(): Promise<FetchResult> {
    const track = this.track ? this.track : await spotify.getTrack(this.id);
    return { tracks: [mapSpotifyTrack(track)] };
  }

}
