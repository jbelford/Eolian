import { createSpotifyClient, mapSpotifyTrack } from '@eolian/api';
import { TrackSource, RangeFactory } from '@eolian/api/@types';
import { SpotifyUser, ISpotifyApi } from '@eolian/api/spotify/@types';
import { getRangeOption } from '@eolian/command-options';
import { CommandOptions } from '@eolian/command-options/@types';
import { CommandContext } from '@eolian/commands/@types';
import { ResourceType } from '@eolian/data/@types';
import { DownloaderDisplay } from '@eolian/framework';
import { ContextSendable } from '@eolian/framework/@types';
import { SourceResolver, ResolvedResource, SourceFetcher, FetchResult } from '../@types';

export class SpotifyLikesResolver implements SourceResolver {
  public source = TrackSource.Spotify;

  constructor(
    private readonly context: CommandContext,
    private readonly params: CommandOptions,
  ) {}

  async resolve(): Promise<ResolvedResource> {
    const request = await this.context.interaction.user.getRequest(
      this.context.interaction,
      TrackSource.Spotify,
    );
    const client = createSpotifyClient(request);
    const user = await client.getMe();
    return createSpotifyLikes(user, client, this.context.interaction.channel, this.params);
  }
}

export function createSpotifyLikes(
  user: SpotifyUser,
  client: ISpotifyApi,
  sendable: ContextSendable,
  params: CommandOptions,
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
    private readonly client: ISpotifyApi,
    private readonly params: CommandOptions,
    private readonly sendable: ContextSendable,
  ) {}

  async fetch(): Promise<FetchResult> {
    const rangeFn: RangeFactory = total => getRangeOption(this.params, total);
    const progress = new DownloaderDisplay(this.sendable, 'Fetching Spotify likes');

    const spotifyTracks = await this.client.getMyTracks(progress, rangeFn);

    const tracks = spotifyTracks.map(item => mapSpotifyTrack(item.track));

    return { tracks, rangeOptimized: true };
  }
}
