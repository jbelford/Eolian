import { EolianBotError } from 'common/errors';
import { EolianCache } from 'data/@types';
import { InMemoryCache } from 'data/cache';
import { google, youtube_v3 } from 'googleapis';

export interface YouTubeApi {
  getResourceType(url: string): YouTubeUrlDetails | undefined;
  getVideo(id: string): Promise<YoutubeVideo | undefined>;
  getPlaylist(id: string): Promise<YoutubePlaylist | undefined>;
  searchPlaylists(query: string): Promise<YoutubePlaylist[]>;
  searchVideos(query: string): Promise<YoutubeVideo[]>;
}

export interface YouTubeUrlDetails {
  type: YouTubeResourceType;
  id: string;
}

export interface YoutubeVideo {
  id: string;
  channelName: string;
  name: string;
  url: string;
}

export interface YoutubePlaylist {
  id: string;
  channelName: string;
  name: string;
  url: string;
  videos?: number;
}

export const enum YouTubeResourceType {
  VIDEO = 0,
  PLAYLIST
}

export class YouTubeApiImpl implements YouTubeApi {

  private readonly youtube: youtube_v3.Youtube;

  constructor(token: string) {
    this.youtube = google.youtube({ version: 'v3', auth: token });
  }

  getResourceType(url: string): YouTubeUrlDetails | undefined {
    const matcher = /youtube.com\/(watch\?v=|playlist\?list=)([^\&]+)/g;
    const regArr = matcher.exec(url);
    if (!regArr) return;
    return {
      id: regArr[2],
      type: regArr[1].includes('watch') ? YouTubeResourceType.VIDEO
        : YouTubeResourceType.PLAYLIST
    };
  }

  async getVideo(id: string): Promise<YoutubeVideo | undefined> {
    try {
      const response = await this.youtube.videos.list({ id, maxResults: 1, part: 'id,snippet,contentDetails' });
      if (!response.data.items) return;

      const video = response.data.items[0];
      return {
        id: video.id!,
        name: video.snippet!.title!,
        channelName: video.snippet!.channelTitle!,
        url: `https://www.youtube.com/watch?v=${video.id}`
      };
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch YouTube playlist');
    }
  }

  async getPlaylist(id: string): Promise<YoutubePlaylist | undefined> {
    try {
      const response = await this.youtube.playlists.list({ id, maxResults: 1, part: 'id,snippet,contentDetails' });
      if (!response.data.items) return;

      const playlist = response.data.items[0];
      return {
        id: playlist.id!,
        name: playlist.snippet!.title!,
        channelName: playlist.snippet!.channelTitle!,
        videos: playlist.contentDetails!.itemCount,
        url: `https://www.youtube.com/playlist?list=${playlist.id}`
      };
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch YouTube playlist');
    }
  }

  async searchPlaylists(query: string): Promise<YoutubePlaylist[]> {
    try {
      const response = await this.youtube.search.list({ q: query, maxResults: 5, type: 'playlist', part: 'id,snippet' });
      if (!response.data.items) return [];

      return response.data.items.map(playlist => ({
        id: playlist.id!.playlistId!,
        name: playlist.snippet!.title!,
        channelName: playlist.snippet!.channelTitle!,
        url: `https://www.youtube.com/playlist?list=${playlist.id!.playlistId}`
      }));
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to search YouTube playlists.');
    }
  }

  async searchVideos(query: string): Promise<YoutubeVideo[]> {
    try {
      const response = await this.youtube.search.list({ q: query, maxResults: 5, type: 'video', part: 'id,snippet' });
      if (!response.data.items) return [];

      return response.data.items.map(video => ({
        id: video.id!.videoId!,
        name: video.snippet!.title!,
        channelName: video.snippet!.channelTitle!,
        url: `https://www.youtube.com/watch?v=${video.id!.videoId}`
      }));
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to search YouTube playlists.');
    }
  }

}

export class CachedYouTubeApi implements YouTubeApi {

  private readonly api: YouTubeApi;
  private readonly cache: EolianCache;

  constructor(token: string, ttl: number) {
    this.api = new YouTubeApiImpl(token);
    this.cache = new InMemoryCache(ttl);
  }

  getResourceType(url: string): YouTubeUrlDetails | undefined {
    return this.api.getResourceType(url);
  }

  async getVideo(id: string): Promise<YoutubeVideo | undefined> {
    return (await this.cache.getOrSet(`video:${id}`, () => this.api.getVideo(id)))[0];
  }
  async getPlaylist(id: string): Promise<YoutubePlaylist | undefined> {
    return (await this.cache.getOrSet(`playlist:${id}`, () => this.api.getPlaylist(id)))[0];
  }
  async searchPlaylists(query: string): Promise<YoutubePlaylist[]> {
    const [playlists, found] = await this.cache.getOrSet(`searchPlaylists:${query}`, () => this.api.searchPlaylists(query));
    if (!found) {
      await Promise.all(playlists.map(playlist => this.cache.set(`playlist:${playlist.id}`, playlist)));
    }
    return playlists;
  }
  async searchVideos(query: string): Promise<YoutubeVideo[]> {
    const [videos, found] = await this.cache.getOrSet(`searchVideos:${query}`, () => this.api.searchVideos(query));
    if (!found) {
      await Promise.all(videos.map(video => this.cache.set(`video:${video.id}`, video)));
    }
    return videos;
  }

}
