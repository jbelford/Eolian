import { ProgressUpdater } from '@eolian/common/@types';
import { environment } from '@eolian/common/env';
import { logger } from '@eolian/common/logger';
import { fuzzyMatch } from '@eolian/common/util';
import { InMemoryLRUCache } from '@eolian/data';
import { MemoryCache } from '@eolian/data/@types';
import { youtube_v3, google } from 'googleapis';
import { decode } from 'html-entities';
import { RangeFactory, Track, StreamSource, TrackSource } from '../@types';
import { bing } from '../bing';
import { IBingApi } from '../bing/@types';
import { IYouTubeApi, YouTubeUrlDetails, YoutubeVideo, YoutubePlaylist } from './@types';
import { YouTubeStreamSource } from './youtube-stream-source';

const SEARCH_MIN_SCORE = 79;
const YOUTUBE_PATTERN =
  /youtube\.com\/(watch|playlist)|youtu(\.be|be\.com\/shorts)\/(?<video>[^/]+)\s*$/;
// eslint-disable-next-line no-useless-escape
const MUSIC_VIDEO_PATTERN = /[\(\[]\s*((official\s+(music\s+)?video)|(music\s+video))\s*[\])]\s*$/i;

class YouTubeApi implements IYouTubeApi {
  private readonly cache: MemoryCache<{ url: string; id: string; live: boolean }>;
  private readonly youtube: youtube_v3.Youtube;

  constructor(
    token: string,
    cacheSize: number,
    private readonly bing?: IBingApi,
  ) {
    this.cache = new InMemoryLRUCache(cacheSize);
    this.youtube = google.youtube({ version: 'v3', auth: token });
  }

  getResourceType(url: string): YouTubeUrlDetails | undefined {
    const [path, query] = url.split('?');

    const match = path.match(YOUTUBE_PATTERN);
    if (match) {
      if (match.groups?.video) {
        return {
          video: match.groups.video,
        };
      } else {
        const parsed = new URLSearchParams(query);
        return {
          playlist: parsed.get('list') ?? undefined,
          video: parsed.get('v') ?? undefined,
        };
      }
    }

    return undefined;
  }

  async getVideo(id: string): Promise<YoutubeVideo | undefined> {
    try {
      logger.info(`YouTube HTTP: videos.list %s`, id);
      const response = await this.youtube.videos.list({
        id: [id],
        maxResults: 1,
        part: ['id', 'snippet', 'contentDetails'],
      });
      if (response.data.items?.length !== 1) {
        return undefined;
      }

      const video = response.data.items[0];
      return mapVideoResponse(video);
    } catch (e) {
      logger.warn(`Failed to fetch YouTube playlist: id: %s`, id);
      throw e;
    }
  }

  async getPlaylist(id: string): Promise<YoutubePlaylist | undefined> {
    try {
      logger.info(`YouTube HTTP: playlists.list %s`, id);
      const response = await this.youtube.playlists.list({
        id: [id],
        maxResults: 1,
        part: ['id', 'snippet', 'contentDetails'],
      });
      if (response.data.items?.length !== 1) {
        return undefined;
      }

      const playlist = response.data.items[0];
      return mapPlaylistResponse(playlist);
    } catch (e) {
      logger.warn(`Failed to fetch YouTube playlist: id: %s`, id);
      throw e;
    }
  }

  async getPlaylistVideos(
    id: string,
    progress?: ProgressUpdater,
    rangeFn?: RangeFactory,
  ): Promise<YoutubeVideo[]> {
    let items: youtube_v3.Schema$PlaylistItem[] = [];

    try {
      logger.info(`YouTube HTTP: playlistItems.list %s`, id);
      let response = await this.youtube.playlistItems.list({
        playlistId: id,
        part: ['id', 'snippet', 'contentDetails', 'status'],
        maxResults: 50,
      });
      items = response.data.items || [];

      let total = response.data.pageInfo?.totalResults ?? undefined;
      if (total === undefined) {
        throw new Error('Playlist is missing total results!');
      } else if (total < 100) {
        progress = undefined;
      }

      const range = rangeFn && rangeFn(total);
      total = range ? range.stop : total;

      progress?.init(total);
      progress?.update(items.length);

      while (response.data.nextPageToken && items.length < total) {
        logger.info(`YouTube HTTP: playlistItems.list %s`, id);
        response = await this.youtube.playlistItems.list({
          playlistId: id,
          part: ['id', 'snippet', 'contentDetails'],
          pageToken: response.data.nextPageToken,
          maxResults: 50,
        });
        items = items.concat(response.data.items || []);
        progress?.update(items.length);
      }

      await progress?.done();

      if (range) {
        items = items.slice(range.start, range.stop);
      }
    } catch (e) {
      logger.warn(`Failed to fetch YouTube playlist: id: %s`, id);
      throw e;
    }

    return items
      .filter(
        item =>
          item.status?.privacyStatus !== 'private' && !!item.snippet?.thumbnails?.default?.url,
      )
      .map(mapVideoResponse);
  }

  async searchPlaylists(query: string, limit = 5): Promise<YoutubePlaylist[]> {
    try {
      logger.info(`YouTube HTTP: search.list type:playlist %s`, query);
      const response = await this.youtube.search.list({
        q: query,
        maxResults: limit,
        type: ['playlist'],
        part: ['id', 'snippet'],
      });
      if (!response.data.items) return [];

      return response.data.items.map(mapPlaylistResponse);
    } catch (e) {
      logger.warn(`Failed to search YouTube playlists: query: %s`, query);
      throw e;
    }
  }

  async searchVideos(query: string, limit = 5): Promise<YoutubeVideo[]> {
    try {
      logger.info(`YouTube HTTP: search.list %s`, query);
      const response = await this.youtube.search.list({
        q: query,
        maxResults: limit + 2,
        // We should not provide the video type. It yields entirely different results for some videos for some reason.
        // type: 'video',
        part: ['id', 'snippet'],
        // These should also be removed for the same reason as type: 'video' until this bug is no longer present
        // topicId: MUSIC_TOPIC,
        // videoCategoryId: MUSIC_CATEGORY_ID
      });
      const videoResponse =
        response.data.items?.filter(item => item.id?.kind === 'youtube#video') ?? [];
      if (!videoResponse.length) return [];

      const videos = videoResponse
        .filter(video => !!video.snippet?.thumbnails?.default?.url)
        .map(mapVideoResponse);

      return videos.slice(0, limit);
    } catch (e) {
      logger.warn(`Failed to search YouTube videos: query: %s`, query);
      throw e;
    }
  }

  async searchSong(name: string, artist: string): Promise<(Track & { score: number })[]> {
    const query = `${artist} ${name}`;
    const videos = await this.searchVideos(query);
    if (videos.length) {
      const sorted = await fuzzyMatch(
        query,
        videos.map(video => `${video.channelName} ${video.name}`),
      );
      return sorted.map(scored => ({
        ...mapYouTubeVideo(videos[scored.key]),
        score: scored.score,
      }));
    } else {
      logger.warn(`Failed to fetch YouTube track for query: %s`, query);
    }
    return [];
  }

  private async searchSongSorted(track: Track): Promise<(Track & { score: number }) | undefined> {
    const videos = await this.searchSong(track.title, track.poster);
    if (videos.length > 0) {
      const video = videos.find(v => !MUSIC_VIDEO_PATTERN.test(v.title));
      if (video) {
        logger.info(
          `Searched YouTube stream '%s %s' selected '%s' - Score: %s`,
          track.poster,
          track.title,
          video.url,
          video.score,
        );
        return video;
      }
    }
    return undefined;
  }

  async searchStreamVideo(track: Track): Promise<Track | undefined> {
    let video: (Track & { score: number }) | undefined;
    if (this.bing) {
      let tracks: Array<Track & { score: number }>;
      try {
        tracks = await this.bing.searchYoutubeSong(track.title, track.poster, track.duration);
        if (tracks.length === 0) {
          throw new Error(`No results from bing`);
        }
      } catch (e) {
        return await this.searchSongSorted(track);
      }
      video = tracks.find(v => !MUSIC_VIDEO_PATTERN.test(v.title)) ?? tracks[0];
      logger.info(
        `Searched Bing stream '%s %s' selected '%s' - Score: %s`,
        track.poster,
        track.title,
        video.url,
        video.score,
      );
      // Fallback on YouTube we get bad results
      if (video.score! <= SEARCH_MIN_SCORE) {
        const ytVideo = await this.searchSongSorted(track);
        if (ytVideo && video.score! < ytVideo.score) {
          video = ytVideo;
        }
      }
    } else {
      video = await this.searchSongSorted(track);
    }
    return video;
  }

  async searchStream(track: Track): Promise<StreamSource | undefined> {
    const cacheId = `${track.src}_` + (track.id ?? `${track.title}_${track.poster}`);
    let result = this.cache.get(cacheId);
    if (!result) {
      const video = await this.searchStreamVideo(track);
      if (video) {
        result = { url: video.url, id: video.id!, live: !!video.live };
        this.cache.set(cacheId, result);
      }
    }
    return result ? new YouTubeStreamSource(result.url, result.id) : undefined;
  }

  async getStream(track: Track): Promise<StreamSource | undefined> {
    if (track.src !== TrackSource.YouTube) {
      throw new Error(
        `Tried to get youtube readable from non-youtube resource: ${JSON.stringify(track)}`,
      );
    }
    return new YouTubeStreamSource(track.url, track.id!);
  }
}

function mapVideoResponse(
  video: youtube_v3.Schema$Video | youtube_v3.Schema$PlaylistItem | youtube_v3.Schema$SearchResult,
): YoutubeVideo {
  const thumbnails = video.snippet!.thumbnails!;
  const id =
    (video as youtube_v3.Schema$PlaylistItem).snippet?.resourceId?.videoId ??
    (typeof video.id! === 'string' ? video.id! : video.id!.videoId!);
  return {
    id,
    name: decode(video.snippet!.title!),
    channelName: decode(video.snippet!.channelTitle!),
    url: `https://www.youtube.com/watch?v=${id}`,
    artwork:
      thumbnails.maxres?.url ??
      thumbnails.standard?.url ??
      thumbnails.medium?.url ??
      thumbnails.default!.url!,
    isLive: (video.snippet as youtube_v3.Schema$VideoSnippet).liveBroadcastContent === 'live',
    blocked: (
      video as youtube_v3.Schema$Video
    ).contentDetails?.regionRestriction?.blocked?.includes?.('US'),
  };
}

function mapPlaylistResponse(
  playlist: youtube_v3.Schema$Playlist | youtube_v3.Schema$SearchResult,
): YoutubePlaylist {
  const id = typeof playlist.id! === 'string' ? playlist.id! : playlist.id!.playlistId!;
  return {
    id,
    name: decode(playlist.snippet!.title!),
    channelName: decode(playlist.snippet!.channelTitle!),
    videos: (playlist as youtube_v3.Schema$Playlist).contentDetails?.itemCount ?? undefined,
    url: `https://www.youtube.com/playlist?list=${id}`,
  };
}

export function mapYouTubeVideo(video: YoutubeVideo): Track {
  return {
    id: video.id,
    poster: video.channelName,
    src: TrackSource.YouTube,
    url: video.url,
    title: video.name,
    stream: video.url,
    artwork: video.artwork,
    live: video.isLive,
  };
}

export const youtube: IYouTubeApi = new YouTubeApi(
  environment.tokens.youtube.token,
  environment.config.youtubeCacheLimit,
  bing,
);
