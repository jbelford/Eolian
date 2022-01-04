import { youtube } from 'api';
import { TrackSource, YoutubeVideo } from 'api/@types';
import { mapYouTubeVideo } from 'api/youtube';
import { CommandContext, CommandOptions } from 'commands/@types';
import { EolianUserError } from 'common/errors';
import { ResourceType } from 'data/@types';
import { ContextMessage } from 'framework/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';

export class YouTubeVideoResolver implements SourceResolver {
  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {}

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
        this.context.interaction.user
      );

      return createYouTubeVideo(videos[result.selected], result.message);
    }
  }
}

export function createYouTubeVideo(
  video: YoutubeVideo,
  message?: ContextMessage
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
  constructor(private readonly id: string, private readonly video?: YoutubeVideo) {}

  async fetch(): Promise<FetchResult> {
    const video = this.video ? this.video : await youtube.getVideo(this.id);
    if (!video) {
      throw new EolianUserError(
        `I could not find details for video https://www.youtube.com/watch?v=${this.id}`
      );
    }
    return { tracks: [mapYouTubeVideo(video)], rangeOptimized: true };
  }
}
