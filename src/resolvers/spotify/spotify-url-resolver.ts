import { createSpotifyClient, mapSpotifyTrack, spotify } from '@eolian/api';
import { TrackSource } from '@eolian/api/@types';
import { SpotifyResourceType, SpotifyTrack } from '@eolian/api/spotify/@types';
import { CommandOptions } from '@eolian/command-options/@types';
import { CommandContext } from '@eolian/commands/@types';
import { EolianUserError } from '@eolian/common/errors';
import { feature } from '@eolian/data';
import { FeatureFlag, ResourceType } from '@eolian/data/@types';
import { SourceResolver, ResolvedResource, SourceFetcher, FetchResult } from '../@types';
import { createSpotifyAlbum } from './spotify-album-resolver';
import { createSpotifyArtist } from './spotify-artist-resolver';
import { createSpotifyPlaylist } from './spotify-playlist-resolver';

export class SpotifyUrlResolver implements SourceResolver {
  public source = TrackSource.Spotify;

  constructor(
    private readonly url: string,
    private readonly params: CommandOptions,
    private readonly context: CommandContext,
  ) {}

  async resolve(): Promise<ResolvedResource> {
    const resourceDetails = spotify.resolve(this.url);
    if (resourceDetails) {
      switch (resourceDetails.type) {
        case SpotifyResourceType.PLAYLIST: {
          return await this.getPlaylist(resourceDetails.id);
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

  private async getPlaylist(id: string): Promise<ResolvedResource> {
    const { channel, user } = this.context.interaction;
    let client = spotify;
    if (feature.enabled(FeatureFlag.SPOTIFY_AUTH)) {
      const { tokens } = await user.get();
      if (tokens?.spotify) {
        const request = await user.getRequest(channel, TrackSource.Spotify);
        client = createSpotifyClient(request);
      }
    }
    const playlist = await client.getPlaylist(id);
    return createSpotifyPlaylist(spotify, playlist, this.params, channel);
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
  constructor(
    private readonly id: string,
    private readonly track?: SpotifyTrack,
  ) {}

  async fetch(): Promise<FetchResult> {
    const track = this.track ? this.track : await spotify.getTrack(this.id);
    return { tracks: [mapSpotifyTrack(track)] };
  }
}
