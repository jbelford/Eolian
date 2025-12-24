import { createSpotifyClient, mapSpotifyTrack } from '@eolian/api';
import { RangeFactory, TrackSource } from '@eolian/api/@types';
import { SpotifyUser, ISpotifyApi, SpotifyTimeRange } from '@eolian/api/spotify/@types';
import { CommandOptions } from '@eolian/command-options/@types';
import { CommandContext } from '@eolian/commands/@types';
import { ResourceType, SpotifyTracksIdentifier } from '@eolian/data/@types';
import { SourceResolver, ResolvedResource, SourceFetcher, FetchResult } from '../@types';
import { DownloaderDisplay } from '@eolian/framework';
import { ContextSendable } from '@eolian/framework/@types';
import { getRangeOption } from '@eolian/command-options';

export class SpotifyTracksResolver implements SourceResolver {
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
    return createSpotifyTracks(
      user,
      client,
      this.context.interaction.channel,
      this.params,
      this.getRange(),
    );
  }

  private getRange(): SpotifyTimeRange | undefined {
    if (this.params.SHORT) {
      return SpotifyTimeRange.SHORT;
    } else if (this.params.LONG) {
      return SpotifyTimeRange.LONG;
    }
    return undefined;
  }
}

export function createSpotifyTracks(
  user: SpotifyUser,
  client: ISpotifyApi,
  sendable: ContextSendable,
  params: CommandOptions,
  range?: SpotifyTimeRange,
): ResolvedResource {
  const term = range
    ? range === SpotifyTimeRange.LONG
      ? 'All Time'
      : 'Last 4 Weeks'
    : 'Last 6 Months';

  return {
    name: `Top Tracks (${term})`,
    authors: [user.display_name ?? '<unknown>'],
    identifier: {
      id: user.id,
      src: TrackSource.Spotify,
      type: ResourceType.Tracks,
      url: user.external_urls.spotify,
      auth: true,
      range,
    } as SpotifyTracksIdentifier,
    fetcher: new SpotifyTracksFetcher(client, params, sendable, range),
  };
}

export class SpotifyTracksFetcher implements SourceFetcher {
  constructor(
    private readonly client: ISpotifyApi,
    private readonly params: CommandOptions,
    private readonly sendable: ContextSendable,
    private readonly range?: SpotifyTimeRange,
  ) {}

  async fetch(): Promise<FetchResult> {
    const rangeFn: RangeFactory = total => getRangeOption(this.params, total);
    const progress = new DownloaderDisplay(this.sendable, `Fetching Spotify top tracks`);
    const spotifyTracks = await this.client.getMyTopTracks(this.range, progress, rangeFn);

    const tracks = spotifyTracks.map(track => mapSpotifyTrack(track));

    return { tracks, rangeOptimized: true };
  }
}
