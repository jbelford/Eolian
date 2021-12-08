import { youtube } from 'api';
import { YoutubeVideo } from 'api/@types';
import { mapYouTubeVideo } from 'api/youtube';
import { CommandContext, CommandOptions } from 'commands/@types';
import { MESSAGES, SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { IdentifierType } from 'data/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';

export class YouTubeVideoResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('Missing search query for YouTube song.');
    }

    const videos = await youtube.searchVideos(this.params.SEARCH);
    const idx = await this.context.interaction.channel.sendSelection('Choose a YouTube video',
      videos.map(video => ({ name: video.name, url: video.url })),
      this.context.interaction.user);
    if (idx < 0) {
      throw new EolianUserError(MESSAGES.NO_SELECTION);
    }

    return createYouTubeVideo(videos[idx]);
  }

}

export function createYouTubeVideo(video: YoutubeVideo): ResolvedResource {
  return {
    name: video.name,
    authors: [video.channelName],
    identifier: {
      id: video.id,
      src: SOURCE.YOUTUBE,
      type: IdentifierType.SONG,
      url: video.url
    },
    fetcher: new YouTubeVideoFetcher(video.id, video)
  };
}

export class YouTubeVideoFetcher implements SourceFetcher {

  constructor(private readonly id: string, private readonly video?: YoutubeVideo) {
  }

  async fetch(): Promise<FetchResult> {
    const video: YoutubeVideo = this.video ? this.video : await youtube.getVideo(this.id);
    return { tracks: [mapYouTubeVideo(video)], rangeOptimized: true };
  }

}
