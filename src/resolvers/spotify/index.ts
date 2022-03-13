import { spotify, youtube } from 'api';
import { SpotifyApi } from 'api/@types';
import { SpotifyApiImpl } from 'api/spotify';
import { CommandContext, CommandOptions } from 'commands/@types';
import { environment } from 'common/env';
import { Identifier, ResourceType } from 'data/@types';
import { SourceFetcher } from 'resolvers/@types';
import { SpotifyAlbumFetcher } from './album';
import { SpotifyArtistFetcher } from './artist';
import { SpotifyLikesFetcher } from './likes';
import { SpotifyPlaylistFetcher } from './playlist';
import { SpotifySongFetcher } from './url';

export { SpotifyAlbumResolver } from './album';
export { SpotifyArtistResolver } from './artist';
export { SpotifyPlaylistResolver } from './playlist';
export { SpotifyUrlResolver } from './url';
export { SpotifyLikesResolver } from './likes';

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
      const client = await getClient(identifier, context);
      return new SpotifyPlaylistFetcher(identifier.id, params, context.interaction, client);
    }
    case ResourceType.Song:
      return new SpotifySongFetcher(identifier.id);
    case ResourceType.Likes:
      if (environment.tokens.spotify.useOAuth) {
        const client = await getClient(identifier, context);
        return new SpotifyLikesFetcher(client, params, context.interaction);
      }
    default:
      throw new Error('Invalid type for Spotify fetcher');
  }
}

async function getClient(identifier: Identifier, context: CommandContext): Promise<SpotifyApi> {
  let client: SpotifyApi = spotify;
  if (identifier.auth && environment.tokens.spotify.useOAuth) {
    const request = await context.interaction.user.getSpotifyRequest();
    client = new SpotifyApiImpl(youtube, request);
  }
  return client;
}
