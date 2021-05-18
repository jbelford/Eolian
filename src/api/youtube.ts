import { SOURCE } from 'common/constants';
import { logger } from 'common/logger';
import { google, youtube_v3 } from 'googleapis';
import { StreamData, Track } from 'music/@types';
import { opus } from 'prism-media';
import querystring from 'querystring';
import { pipeline } from 'stream';
import ytdl from 'ytdl-core';
import { YouTubeApi, YoutubePlaylist, YouTubeUrlDetails, YoutubeVideo } from './@types';

const MUSIC_TOPIC = '/m/04rlf';

export class YouTubeApiImpl implements YouTubeApi {

  private readonly youtube: youtube_v3.Youtube;

  constructor(token: string) {
    this.youtube = google.youtube({ version: 'v3', auth: token });
  }

  getResourceType(url: string): YouTubeUrlDetails | undefined {
    const [path, query] = url.split('?');

    if (path.match(/youtube\.com\/(watch|playlist)/g)) {
      const parsed = querystring.parse(query);
      return {
        playlist: parsed['list'] as string,
        video: parsed['v'] as string
      };
    }

    return undefined;
  }

  async getVideo(id: string): Promise<YoutubeVideo> {
    try {
      // @ts-ignore Typescript is dumb
      const response = await this.youtube.videos.list({ id, maxResults: 1, part: 'id,snippet,contentDetails' });
      if (!response.data.items) throw new Error('No results from YouTube');

      const video = response.data.items[0];
      return {
        id: video.id!,
        name: video.snippet!.title!,
        channelName: video.snippet!.channelTitle!,
        url: `https://www.youtube.com/watch?v=${video.id}`,
        artwork: video.snippet!.thumbnails!.high!.url!
      };
    } catch (e) {
      logger.warn(`Failed to fetch YouTube playlist: id: ${id}`);
      throw e;
    }
  }

  async getPlaylist(id: string): Promise<YoutubePlaylist> {
    try {
      // @ts-ignore Typescript is dumb
      const response = await this.youtube.playlists.list({ id, maxResults: 1, part: 'id,snippet,contentDetails' });
      if (!response.data.items) throw new Error('No results from YouTube');

      const playlist = response.data.items[0];
      return {
        id: playlist.id!,
        name: playlist.snippet!.title!,
        channelName: playlist.snippet!.channelTitle!,
        videos: playlist.contentDetails!.itemCount || undefined,
        url: `https://www.youtube.com/playlist?list=${playlist.id}`
      };
    } catch (e) {
      logger.warn(`Failed to fetch YouTube playlist: id: ${id}`);
      throw e;
    }
  }

  async getPlaylistVideos(id: string): Promise<YoutubeVideo[]> {
    let items: youtube_v3.Schema$PlaylistItem[] = [];

    try {
      // @ts-ignore Typescript is dumb
      let response = await this.youtube.playlistItems.list({ playlistId: id, part: 'id,snippet,contentDetails' });
      items = response.data.items || [];
      while (response.data.nextPageToken) {
        const params = { playlistId: id, part: 'id,snippet,contentDetails', pageToken: response.data.nextPageToken };
        // @ts-ignore Typescript is dumb
        response = await this.youtube.playlistItems.list(params);
        items = items.concat(response.data.items || []);
      }
    } catch (e) {
      logger.warn(`Failed to fetch YouTube playlist: id: ${id}`);
      throw e;
    }

    return items.map(item => ({
      id: item.id!,
      name: item.snippet!.title!,
      channelName: item.snippet!.channelTitle!,
      url: `https://www.youtube.com/watch?v=${item.id}`,
      artwork: item.snippet!.thumbnails!.default!.url!
    }));
  }

  async searchPlaylists(query: string): Promise<YoutubePlaylist[]> {
    try {
      // @ts-ignore Typescript is dumb
      const response = await this.youtube.search.list({ q: query, maxResults: 5, type: 'playlist', part: 'id,snippet' });
      if (!response.data.items) return [];

      return response.data.items.map(playlist => ({
        id: playlist.id!.playlistId!,
        name: playlist.snippet!.title!,
        channelName: playlist.snippet!.channelTitle!,
        url: `https://www.youtube.com/playlist?list=${playlist.id!.playlistId}`
      }));
    } catch (e) {
      logger.warn(`Failed to search YouTube playlists: query: ${query}`);
      throw e;
    }
  }

  async searchVideos(query: string): Promise<YoutubeVideo[]> {
    try {
      // @ts-ignore Typescript is dumb
      const response = await this.youtube.search.list({q: query, maxResults: 5, type: 'video', part: 'id,snippet', topicId: MUSIC_TOPIC });
      if (!response.data.items) return [];

      return response.data.items.map(video => ({
        id: video.id!.videoId!,
        name: video.snippet!.title!,
        channelName: video.snippet!.channelTitle!,
        url: `https://www.youtube.com/watch?v=${video.id!.videoId}`,
        artwork: video.snippet!.thumbnails!.default!.url!
      }));
    } catch (e) {
      logger.warn(`Failed to search YouTube videos: query: ${query}`);
      throw e;
    }
  }

  async searchStream(track: Track): Promise<StreamData | undefined> {
    const query = `${track.title} ${track.poster}`;
    const videos = await this.searchVideos(query);
    if (videos.length > 0) {
      const youtubeTrack = mapYouTubeVideo(videos[0]);
      return this.getStream(youtubeTrack);
    }
    logger.warn(`Failed to fetch YouTube track for query: ${query}`);
    return undefined;
  }

  async getStream(track: Track): Promise<StreamData | undefined> {
    if (track.src !== SOURCE.YOUTUBE) {
      throw new Error(`Tried to get youtube readable from non-youtube resource: ${JSON.stringify(track)}`);
    }

    const info = await ytdl.getInfo(track.url);
    const formats = ytdl.filterFormats(info.formats, ytdlFilter);
    if (formats.length) {
      const stream = pipeline(
        ytdl.downloadFromInfo(info, { filter: ytdlFilter }),
        new opus.WebmDemuxer(),
        () => ({}));
      return { readable: stream, details: track, opus: true };
    } else {
      const stream = ytdl.downloadFromInfo(info, { filter: 'audioonly', quality: 'highestaudio' });
      return { readable: stream, details: track };
    }
  }

}

const ytdlFilter: ytdl.Filter = format => format.codecs === 'opus' &&
  format.container === 'webm' &&
  format.audioSampleRate === '48000';

export function mapYouTubeVideo(video: YoutubeVideo): Track {
  return {
    id: video.id,
    poster: video.channelName,
    src: SOURCE.YOUTUBE,
    url: video.url,
    title: video.name,
    stream: video.url,
    artwork: video.artwork
  };
}