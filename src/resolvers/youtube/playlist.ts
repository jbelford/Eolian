import { youtube } from 'api';
import { RangeFactory, TrackSource, YoutubePlaylist } from 'api/@types';
import { mapYouTubeVideo } from 'api/youtube';
import { CommandContext, CommandOptions } from 'commands/@types';
import { getRangeOption } from 'commands/patterns';
import { EolianUserError } from 'common/errors';
import { ResourceType } from 'data/@types';
import { DownloaderDisplay } from 'framework';
import { ContextMessage, ContextSendable } from 'framework/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';

export class YouTubePlaylistResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {}

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('Missing search query for YouTube playlist.');
    }

    const playlists = await youtube.searchPlaylists(this.params.SEARCH, this.params.FAST ? 1 : 5);
    if (playlists.length === 0) {
      throw new EolianUserError('No YouTube playlists were found.');
    } else if (playlists.length === 1) {
      return createYouTubePlaylist(playlists[0], this.params, this.context.interaction.channel);
    } else {
      const result = await this.context.interaction.sendSelection(
        'Choose a YouTube playlist',
        playlists.map(playlist => ({ name: playlist.name, url: playlist.url })),
        this.context.interaction.user
      );

      return createYouTubePlaylist(
        playlists[result.selected],
        this.params,
        this.context.interaction.channel,
        result.message
      );
    }
  }

}

export function createYouTubePlaylist(
  playlist: YoutubePlaylist,
  params: CommandOptions,
  sendable: ContextSendable,
  message?: ContextMessage
): ResolvedResource {
  return {
    name: playlist.name,
    authors: [playlist.channelName],
    identifier: {
      id: playlist.id,
      src: TrackSource.YouTube,
      type: ResourceType.Playlist,
      url: playlist.url,
    },
    fetcher: new YouTubePlaylistFetcher(playlist.id, params, sendable),
    selectionMessage: message,
  };
}

export class YouTubePlaylistFetcher implements SourceFetcher {

  constructor(
    private readonly id: string,
    private readonly params: CommandOptions,
    private readonly sendable: ContextSendable
  ) {}

  async fetch(): Promise<FetchResult> {
    const progress = new DownloaderDisplay(this.sendable, 'Fetching playlist tracks');
    const rangeFn: RangeFactory = total => getRangeOption(this.params, total);
    const videos = await youtube.getPlaylistVideos(this.id, progress, rangeFn);
    return { tracks: videos.map(mapYouTubeVideo), rangeOptimized: true };
  }

}
