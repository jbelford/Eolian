import { youtube } from 'api';
import { YoutubePlaylist, YouTubeResourceType, YoutubeVideo } from 'api/youtube';
import { CommandContext, CommandOptions } from 'commands/@types';
import { SOURCE } from 'common/constants';
import { EolianBotError } from 'common/errors';
import { IdentifierType } from 'data/@types';
import { ResolvedResource, SourceResolver } from './@types';

export class YouTubeResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    let resource: ResolvedResource;

    if (this.params.URL) {
      resource = await resolveUrl(this.params.URL.value);
    } else {
      resource = await this.resolveTarget();
    }

    return resource;
  }

  private resolveTarget(): Promise<ResolvedResource> {
    if (this.params.PLAYLIST) {
      return this.resolvePlaylist();
    }
    return this.resolveSong();
  }

  private async resolvePlaylist(): Promise<ResolvedResource> {
    if (!this.params.QUERY) {
      throw new EolianBotError('Missing query for YouTube playlist.');
    }

    const playlists = await youtube.searchPlaylists(this.params.QUERY);
    const idx = await this.context.channel.sendSelection('Choose a YouTube playlist',
      playlists.map(playlist => playlist.name), this.context.user.id);
    if (idx === undefined) throw new EolianBotError('Nothing selected. Cancelled request.');

    const playlist = playlists[idx];
    return createYouTubePlaylist(playlist);
  }

  private async resolveSong(): Promise<ResolvedResource> {
    if (!this.params.QUERY) {
      throw new EolianBotError('Missing query for YouTube song.');
    }

    const videos = await youtube.searchVideos(this.params.QUERY);
    const idx = await this.context.channel.sendSelection('Choose a YouTube video',
      videos.map(video => video.name), this.context.user.id);
    if (idx === undefined) {
      throw new EolianBotError('Nothing selected. Cancelled request.');
    }

    return createYouTubeVideo(videos[idx]);
  }

}

async function resolveUrl(url: string): Promise<ResolvedResource> {
  const resourceDetails = youtube.getResourceType(url);
  if (resourceDetails) {
    switch (resourceDetails.type) {
      case YouTubeResourceType.PLAYLIST:
        const playlist = await youtube.getPlaylist(resourceDetails.id);
        return createYouTubePlaylist(playlist!);
      case YouTubeResourceType.VIDEO:
        const video = await youtube.getVideo(resourceDetails.id);
        return createYouTubeVideo(video!);
      default:
    }
  }
  throw new EolianBotError('The YouTube URL provided is not valid!');
}

function createYouTubePlaylist(playlist: YoutubePlaylist): ResolvedResource {
  return {
    name: playlist.name,
    authors: [playlist.channelName],
    identifier: {
      id: playlist.id,
      src: SOURCE.YOUTUBE,
      type: IdentifierType.PLAYLIST,
      url: playlist.url
    }
  };
}

function createYouTubeVideo(video: YoutubeVideo): ResolvedResource {
  return {
    name: video.name,
    authors: [video.channelName],
    identifier: {
      id: video.id,
      src: SOURCE.YOUTUBE,
      type: IdentifierType.SONG,
      url: video.url
    }
  }
}