import { EolianBotError } from 'common/errors';
import environment from 'environments/env';
import { google } from 'googleapis';

export const enum YouTubeResourceType {
  VIDEO = 0,
  PLAYLIST
}

export namespace YouTube {
  const youtube = google.youtube({
    version: 'v3',
    auth: environment.tokens.youtube
  });

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

  export async function getVideo(id: string): Promise<YoutubeVideo> {
    try {
      const response = await youtube.videos.list({ id: id, maxResults: 1, part: 'id,snippet,contentDetails' });
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

  export async function getPlaylist(id: string): Promise<YoutubePlaylist> {
    try {
      const response = await youtube.playlists.list({ id: id, maxResults: 1, part: 'id,snippet,contentDetails' });
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

  export async function searchPlaylists(query: string): Promise<YoutubePlaylist[]> {
    try {
      const response = await youtube.search.list({ q: query, maxResults: 5, type: 'playlist', part: 'id,snippet' });
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

  export async function searchVideos(query: string): Promise<YoutubeVideo[]> {
    try {
      const response = await youtube.search.list({ q: query, maxResults: 5, type: 'video', part: 'id,snippet' });
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