import { createSpotifyClient, mapSpotifyTrack } from 'api';
import { RangeFactory, SpotifyApi, SpotifyUser, TrackSource } from 'api/@types';
import { CommandContext, CommandOptions } from 'commands/@types';
import { getRangeOption } from 'commands/patterns';
import { ResourceType } from 'data/@types';
import { DownloaderDisplay } from 'framework';
import { ContextSendable } from 'framework/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';

export class SpotifyLikesResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {}

  async resolve(): Promise<ResolvedResource> {
    const request = await this.context.interaction.user.getSpotifyRequest(this.context.interaction);
    const client = createSpotifyClient(request);
    const user = await client.getMe();
    return createSpotifyLikes(user, client, this.context.interaction, this.params);
  }

}

export function createSpotifyLikes(
  user: SpotifyUser,
  client: SpotifyApi,
  sendable: ContextSendable,
  params: CommandOptions
): ResolvedResource {
  return {
    name: 'Liked Tracks',
    authors: [user.display_name ?? '<unknown>'],
    identifier: {
      id: user.id,
      src: TrackSource.Spotify,
      type: ResourceType.Likes,
      url: user.external_urls.spotify,
      auth: true,
    },
    fetcher: new SpotifyLikesFetcher(client, params, sendable),
  };
}

export class SpotifyLikesFetcher implements SourceFetcher {

  constructor(
    private readonly client: SpotifyApi,
    private readonly params: CommandOptions,
    private readonly sendable: ContextSendable
  ) {}

  async fetch(): Promise<FetchResult> {
    const rangeFn: RangeFactory = total => getRangeOption(this.params, total);
    const progress = new DownloaderDisplay(this.sendable, 'Fetching Spotify likes');

    const spotifyTracks = await this.client.getMyTracks(progress, rangeFn);

    const tracks = spotifyTracks.map(item => mapSpotifyTrack(item.track));

    return { tracks, rangeOptimized: true };
  }

}
