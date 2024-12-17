import { createSpotifyClient, spotify } from '@eolian/api';
import { TrackSource } from '@eolian/api/@types';
import { ISpotifyApi } from '@eolian/api/spotify/@types';
import { CommandOptions } from '@eolian/command-options/@types';
import { CommandContext } from '@eolian/commands/@types';
import { feature } from '@eolian/data';
import {
  Identifier,
  ResourceType,
  FeatureFlag,
  SpotifyTracksIdentifier,
} from '@eolian/data/@types';
import { SourceFetcher } from '../@types';
import { SpotifyAlbumFetcher } from './spotify-album-resolver';
import { SpotifyArtistFetcher } from './spotify-artist-resolver';
import { SpotifyLikesFetcher } from './spotify-likes-resolver';
import { SpotifyPlaylistFetcher } from './spotify-playlist-resolver';
import { SpotifyTracksFetcher } from './spotify-tracks-resolver';
import { SpotifySongFetcher } from './spotify-url-resolver';

export { SpotifyAlbumResolver } from './spotify-album-resolver';
export { SpotifyArtistResolver } from './spotify-artist-resolver';
export { SpotifyPlaylistResolver } from './spotify-playlist-resolver';
export { SpotifyUrlResolver } from './spotify-url-resolver';
export { SpotifyLikesResolver } from './spotify-likes-resolver';
export { SpotifyTracksResolver } from './spotify-tracks-resolver';

export async function getSpotifySourceFetcher(
  identifier: Identifier,
  context: CommandContext,
  params: CommandOptions,
): Promise<SourceFetcher> {
  switch (identifier.type) {
    case ResourceType.Album:
      return new SpotifyAlbumFetcher(identifier.id);
    case ResourceType.Artist:
      return new SpotifyArtistFetcher(identifier.id);
    case ResourceType.Playlist: {
      const client = feature.enabled(FeatureFlag.SPOTIFY_AUTH)
        ? await getClient(identifier, context)
        : spotify;
      return new SpotifyPlaylistFetcher(identifier.id, params, context.interaction.channel, client);
    }
    case ResourceType.Song:
      return new SpotifySongFetcher(identifier.id);
    case ResourceType.Likes:
      if (feature.enabled(FeatureFlag.SPOTIFY_AUTH)) {
        const client = await getClient(identifier, context);
        return new SpotifyLikesFetcher(client, params, context.interaction.channel);
      }
      break;
    case ResourceType.Tracks:
      if (feature.enabled(FeatureFlag.SPOTIFY_AUTH)) {
        const { range } = identifier as SpotifyTracksIdentifier;
        const client = await getClient(identifier, context);
        return new SpotifyTracksFetcher(client, range);
      }
      break;
    default:
  }
  throw new Error('Invalid type for Spotify fetcher');
}

async function getClient(identifier: Identifier, context: CommandContext): Promise<ISpotifyApi> {
  let client: ISpotifyApi = spotify;
  if (identifier.auth) {
    const request = await context.interaction.user.getRequest(
      context.interaction,
      TrackSource.Spotify,
    );
    client = createSpotifyClient(request);
  }
  return client;
}
