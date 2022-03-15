import { createSpotifyClient, mapSpotifyTrack } from 'api';
import { TrackSource } from 'api/@types';
import { SpotifyApi, SpotifyUser } from 'api/spotify/@types';
import { CommandContext } from 'commands/@types';
import { ResourceType } from 'data/@types';
import { SourceResolver, ResolvedResource, SourceFetcher, FetchResult } from 'resolvers/@types';

export class SpotifyTracksResolver implements SourceResolver {

  constructor(private readonly context: CommandContext) {}

  async resolve(): Promise<ResolvedResource> {
    const request = await this.context.interaction.user.getRequest(
      this.context.interaction,
      TrackSource.Spotify
    );
    const client = createSpotifyClient(request);
    const user = await client.getMe();
    return createSpotifyTracks(user, client);
  }

}

export function createSpotifyTracks(user: SpotifyUser, client: SpotifyApi): ResolvedResource {
  return {
    name: 'Top Tracks',
    authors: [user.display_name ?? '<unknown>'],
    identifier: {
      id: user.id,
      src: TrackSource.Spotify,
      type: ResourceType.Tracks,
      url: user.external_urls.spotify,
      auth: true,
    },
    fetcher: new SpotifyTracksFetcher(client),
  };
}

export class SpotifyTracksFetcher implements SourceFetcher {

  constructor(private readonly client: SpotifyApi) {}

  async fetch(): Promise<FetchResult> {
    const spotifyTracks = await this.client.getMyTopTracks();

    const tracks = spotifyTracks.map(track => mapSpotifyTrack(track));

    return { tracks };
  }

}
