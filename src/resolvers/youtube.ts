import { youtube } from 'api';
import { Track, YoutubePlaylist, YoutubeVideo } from 'api/@types';
import { mapYouTubeVideo } from 'api/youtube';
import { CommandContext, CommandOptions } from 'commands/@types';
import { MESSAGES, SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { Identifier, IdentifierType } from 'data/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from './@types';

export class YouTubeUrlResolver implements SourceResolver {
  constructor(private readonly url: string,
    private readonly context: CommandContext) {
  }

  async resolve(): Promise<ResolvedResource> {
    const resourceDetails = youtube.getResourceType(this.url);
    if (resourceDetails) {
      if (resourceDetails.video && resourceDetails.playlist) {
        const idx = await this.context.channel.sendSelection('Do you want this video or the playlist?', ['Video', 'Playlist'], this.context.user);
        switch (idx) {
          // @ts-ignore
          default:
            await this.context.channel.send('No selection.. defaulting to video');
          case 0:
            resourceDetails.playlist = undefined;
            break;
          case 1:
            resourceDetails.video = undefined;
            break;
        }
      }

      if (resourceDetails.video) {
        const video = await youtube.getVideo(resourceDetails.video);
        return createYouTubeVideo(video);
      } else if (resourceDetails.playlist) {
        const playlist = await youtube.getPlaylist(resourceDetails.playlist);
        return createYouTubePlaylist(playlist);
      }
    }
    throw new EolianUserError('The YouTube URL provided is not valid!');
  }
}

export class YouTubePlaylistResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('Missing search query for YouTube playlist.');
    }

    const playlists = await youtube.searchPlaylists(this.params.SEARCH);
    const idx = await this.context.channel.sendSelection('Choose a YouTube playlist',
      playlists.map(playlist => ({ name: playlist.name, url: playlist.url })),
      this.context.user);
    if (idx < 0) {
      throw new EolianUserError(MESSAGES.NO_SELECTION);
    }

    const playlist = playlists[idx];
    return createYouTubePlaylist(playlist);
  }
}

export class YouTubeVideoResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('Missing search query for YouTube song.');
    }

    const videos = await youtube.searchVideos(this.params.SEARCH);
    const idx = await this.context.channel.sendSelection('Choose a YouTube video',
      videos.map(video => ({ name: video.name, url: video.url })),
      this.context.user);
    if (idx < 0) {
      throw new EolianUserError(MESSAGES.NO_SELECTION);
    }

    return createYouTubeVideo(videos[idx]);
  }

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
    },
    tracks: [mapYouTubeVideo(video)]
  }
}

export class YouTubeFetcher implements SourceFetcher {

  constructor(private readonly identifier: Identifier) {}

  async fetch(): Promise<FetchResult> {
    if (this.identifier.src !== SOURCE.YOUTUBE) {
      throw new Error('Attempted to fetch tracks for incorrect source type');
    }

    switch (this.identifier.type) {
      case IdentifierType.PLAYLIST: return { tracks: await this.fetchPlaylist(this.identifier.id) };
      case IdentifierType.SONG: return { tracks: [await this.fetchVideo(this.identifier.id)] };
      default: throw new Error(`Identifier type is unrecognized ${this.identifier.type}`);
    }
  }

  async fetchPlaylist(id: string): Promise<Track[]> {
    const videos = await youtube.getPlaylistVideos(id);
    return videos.map(mapYouTubeVideo);
  }

  async fetchVideo(id: string): Promise<Track> {
    const video = await youtube.getVideo(id);
    return mapYouTubeVideo(video);
  }

}