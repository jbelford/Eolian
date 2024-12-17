import { ProgressUpdater } from '@eolian/common/@types';
import { StreamFetcher, RangeFactory, Track, StreamSource } from '../@types';

export interface IYouTubeApi extends StreamFetcher {
  getResourceType(url: string): YouTubeUrlDetails | undefined;
  getVideo(id: string): Promise<YoutubeVideo | undefined>;
  getPlaylist(id: string): Promise<YoutubePlaylist | undefined>;
  getPlaylistVideos(
    id: string,
    progress?: ProgressUpdater,
    rangeFn?: RangeFactory,
  ): Promise<YoutubeVideo[]>;
  searchPlaylists(query: string, limit?: number): Promise<YoutubePlaylist[]>;
  searchVideos(query: string, limit?: number): Promise<YoutubeVideo[]>;
  searchStream(track: Track): Promise<StreamSource | undefined>;
}

export interface YouTubeUrlDetails {
  video?: string;
  playlist?: string;
}

export interface YoutubeVideo {
  id: string;
  channelName: string;
  name: string;
  url: string;
  artwork: string;
  isLive?: boolean;
  blocked?: boolean;
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
  PLAYLIST,
}
