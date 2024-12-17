import { mapYouTubeVideo, youtube } from '@eolian/api';
import { TrackSource } from '@eolian/api/@types';
import { YoutubeVideo } from '@eolian/api/youtube/@types';
import { CommandOptions } from '@eolian/command-options/@types';
import { CommandContext } from '@eolian/commands/@types';
import { EolianUserError } from '@eolian/common/errors';
import { ResourceType } from '@eolian/data/@types';
import { ContextMessage } from '@eolian/framework/@types';
import { SourceResolver, ResolvedResource, SourceFetcher, FetchResult } from '../@types';

export class YouTubeVideoResolver implements SourceResolver {
  public source = TrackSource.YouTube;

  constructor(
    private readonly context: CommandContext,
    private readonly params: CommandOptions,
  ) {}

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('Missing search query for YouTube song.');
    }

    const videos = await youtube.searchVideos(this.params.SEARCH, this.params.FAST ? 1 : 5);
    if (videos.length === 0) {
      throw new EolianUserError('No YouTube videos were found.');
    } else if (videos.length === 1) {
      return createYouTubeVideo(videos[0]);
    } else {
      const result = await this.context.interaction.sendSelection(
        'Choose a YouTube video',
        videos.map(video => ({ name: video.name, url: video.url })),
        this.context.interaction.user,
      );

      return createYouTubeVideo(videos[result.selected], result.message);
    }
  }
}

export function createYouTubeVideo(
  video: YoutubeVideo,
  message?: ContextMessage,
): ResolvedResource {
  return {
    name: video.name,
    authors: [video.channelName],
    identifier: {
      id: video.id,
      src: TrackSource.YouTube,
      type: ResourceType.Song,
      url: video.url,
    },
    fetcher: new YouTubeVideoFetcher(video.id, video),
    selectionMessage: message,
  };
}

export class YouTubeVideoFetcher implements SourceFetcher {
  constructor(
    private readonly id: string,
    private readonly video?: YoutubeVideo,
  ) {}

  async fetch(): Promise<FetchResult> {
    const video = this.video ? this.video : await youtube.getVideo(this.id);
    if (!video) {
      throw new EolianUserError(
        `I could not find details for video https://www.youtube.com/watch?v=${this.id}`,
      );
    } else if (video.blocked) {
      throw new EolianUserError(
        `🚫 The video https://www.youtube.com/watch?v=${this.id} is blocked in my region`,
      );
    }
    return { tracks: [mapYouTubeVideo(video)], rangeOptimized: true };
  }
}
