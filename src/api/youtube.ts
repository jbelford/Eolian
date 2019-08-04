import environment from 'common/env';
import { EolianBotError } from 'common/errors';
import { InMemoryCache } from 'data/memory/cache';
import { google, youtube_v3 } from 'googleapis';

export const enum YouTubeResourceType {
  VIDEO = 0,
  PLAYLIST
}

interface YouTubeApi {

  getVideo(id: string): Promise<YoutubeVideo>;
  getPlaylist(id: string): Promise<YoutubePlaylist>;
  searchPlaylists(query: string): Promise<YoutubePlaylist[]>;
  searchVideos(query: string): Promise<YoutubeVideo[]>;

}

class YouTubeApiImpl implements YouTubeApi {

  private readonly youtube: youtube_v3.Youtube;

  constructor(token: string) {
    this.youtube = google.youtube({ version: 'v3', auth: token });
  }

  async getVideo(id: string): Promise<YoutubeVideo> {
    try {
      const response = await this.youtube.videos.list({ id: id, maxResults: 1, part: 'id,snippet,contentDetails' });
      const video = response.data.items[0];
      return {
        id: video.id,
        name: video.snippet.title,
        channelName: video.snippet.channelTitle,
        url: `https://www.youtube.com/watch?v=${video.id}`
      };
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch YouTube playlist');
    }
  }

  async getPlaylist(id: string): Promise<YoutubePlaylist> {
    try {
      const response = await this.youtube.playlists.list({ id: id, maxResults: 1, part: 'id,snippet,contentDetails' });
      const playlist = response.data.items[0];
      return {
        id: playlist.id,
        name: playlist.snippet.title,
        channelName: playlist.snippet.channelTitle,
        videos: playlist.contentDetails.itemCount,
        url: `https://www.youtube.com/playlist?list=${playlist.id}`
      };
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch YouTube playlist');
    }
  }

  async searchPlaylists(query: string): Promise<YoutubePlaylist[]> {
    try {
      const response = await this.youtube.search.list({ q: query, maxResults: 5, type: 'playlist', part: 'id,snippet' });
      return response.data.items.map(playlist => ({
        id: playlist.id.playlistId,
        name: playlist.snippet.title,
        channelName: playlist.snippet.channelTitle,
        url: `https://www.youtube.com/playlist?list=${playlist.id.playlistId}`
      }));
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to search YouTube playlists.');
    }
  }

  async searchVideos(query: string): Promise<YoutubeVideo[]> {
    try {
      const response = await this.youtube.search.list({ q: query, maxResults: 5, type: 'video', part: 'id,snippet' });
      return response.data.items.map(video => ({
        id: video.id.videoId,
        name: video.snippet.title,
        channelName: video.snippet.channelTitle,
        url: `https://www.youtube.com/watch?v=${video.id.videoId}`
      }));
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to search YouTube playlists.');
    }
  }

}

class CachedYouTubeApi implements YouTubeApi {

  private readonly api: YouTubeApi;
  private readonly cache: EolianCache<any>;

  constructor(token: string, ttl: number) {
    this.api = new YouTubeApiImpl(token);
    this.cache = new InMemoryCache(ttl);
  }

  async getVideo(id: string): Promise<YoutubeVideo> {
    return (await this.cache.getOrSet(`video:${id}`, () => this.api.getVideo(id)))[0];
  }
  async getPlaylist(id: string): Promise<YoutubePlaylist> {
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

export namespace YouTube {

  export const API: YouTubeApi = new CachedYouTubeApi(environment.tokens.youtube, 1000 * 30);

  export function getResourceType(url: string): YouTubeUrlDetails {
    const matcher = /youtube.com\/(watch\?v=|playlist\?list=)([^\&]+)/g;
    const regArr = matcher.exec(url);
    if (!regArr) return null;
    return {
      id: regArr[2],
      type: regArr[1].includes('watch') ? YouTubeResourceType.VIDEO
        : YouTubeResourceType.PLAYLIST
    };
  }

}