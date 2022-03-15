import { createSpotifyClient, spotify } from 'api';
import { TrackSource } from 'api/@types';
import { SpotifyApi } from 'api/spotify/@types';
import { CommandContext, CommandOptions } from 'commands/@types';
import { feature } from 'data';
import { Identifier, ResourceType, FeatureFlag } from 'data/@types';
import { SourceFetcher } from 'resolvers/@types';
import { SpotifyAlbumFetcher } from './album';
import { SpotifyArtistFetcher } from './artist';
import { SpotifyLikesFetcher } from './likes';
import { SpotifyPlaylistFetcher } from './playlist';
import { SpotifyTracksFetcher } from './tracks';
import { SpotifySongFetcher } from './url';

export { SpotifyAlbumResolver } from './album';
export { SpotifyArtistResolver } from './artist';
export { SpotifyPlaylistResolver } from './playlist';
export { SpotifyUrlResolver } from './url';
export { SpotifyLikesResolver } from './likes';
export { SpotifyTracksResolver } from './tracks';

export async function getSpotifySourceFetcher(
  identifier: Identifier,
  context: CommandContext,
  params: CommandOptions
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
      return new SpotifyPlaylistFetcher(identifier.id, params, context.interaction, client);
    }
    case ResourceType.Song:
      return new SpotifySongFetcher(identifier.id);
    case ResourceType.Likes:
      if (feature.enabled(FeatureFlag.SPOTIFY_AUTH)) {
        const client = await getClient(identifier, context);
        return new SpotifyLikesFetcher(client, params, context.interaction);
      }
      break;
    case ResourceType.Tracks:
      if (feature.enabled(FeatureFlag.SPOTIFY_AUTH)) {
        const client = await getClient(identifier, context);
        return new SpotifyTracksFetcher(client);
      }
      break;
    default:
  }
  throw new Error('Invalid type for Spotify fetcher');
}

async function getClient(identifier: Identifier, context: CommandContext): Promise<SpotifyApi> {
  let client: SpotifyApi = spotify;
  if (identifier.auth) {
    const request = await context.interaction.user.getRequest(
      context.interaction,
      TrackSource.Spotify
    );
    client = createSpotifyClient(request);
  }
  return client;
}
