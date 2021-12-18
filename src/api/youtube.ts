import { SOURCE } from 'common/constants';
import { environment } from 'common/env';
import { logger } from 'common/logger';
import { fuzzyMatch } from 'common/util';
import { InMemoryLRUCache } from 'data';
import { MemoryCache } from 'data/@types';
import { google, youtube_v3 } from 'googleapis';
import { decode } from 'html-entities';
import * as play from 'play-dl';
import querystring from 'querystring';
import { Readable } from 'stream';
import { BingApi, StreamSource, Track, YouTubeApi, YoutubePlaylist, YouTubeUrlDetails, YoutubeVideo } from './@types';

// const MUSIC_CATEGORY_ID = 10;
// const MUSIC_TOPIC = '/m/04rlf';

const SEARCH_MIN_SCORE = 79;
const YOUTUBE_PATTERN = /youtube\.com\/(watch|playlist)|youtu\.be\/(?<video>[^/]+)\s*$/
// eslint-disable-next-line no-useless-escape
const MUSIC_VIDEO_PATTERN = /[\(\[]\s*((official\s+(music\s+)?video)|(music\s+video))\s*[\])]\s*$/i;

play.setToken({ youtube: { cookie: environment.tokens.youtube.cookie } });

export class YouTubeApiImpl implements YouTubeApi {

  private readonly cache: MemoryCache<{ url: string, live: boolean }>;
  private readonly youtube: youtube_v3.Youtube;

  constructor(token: string, cacheSize: number, private readonly bing?: BingApi) {
    this.cache = new InMemoryLRUCache(cacheSize);
    this.youtube = google.youtube({ version: 'v3', auth: token });
  }

  getResourceType(url: string): YouTubeUrlDetails | undefined {
    const [path, query] = url.split('?');

    const match = path.match(YOUTUBE_PATTERN);
    if (match) {
      if (match.groups?.video) {
        return {
          video: match.groups['video']
        }
      } else {
        const parsed = querystring.parse(query);
        return {
          playlist: parsed['list'] as string,
          video: parsed['v'] as string
        };
      }
    }

    return undefined;
  }

  async getVideo(id: string): Promise<YoutubeVideo> {
    try {
      logger.info(`YouTube HTTP: videos.list ${id}`);
      const response = await this.youtube.videos.list({ id: [id], maxResults: 1, part: ['id', 'snippet', 'contentDetails'] });
      if (!response.data.items) throw new Error('No results from YouTube');

      const video = response.data.items[0];
      return mapVideoResponse(video);
    } catch (e) {
      logger.warn(`Failed to fetch YouTube playlist: id: %s`, id);
      throw e;
    }
  }

  async getPlaylist(id: string): Promise<YoutubePlaylist> {
    try {
      logger.info(`YouTube HTTP: playlists.list ${id}`);
      const response = await this.youtube.playlists.list({ id: [id], maxResults: 1, part: ['id', 'snippet', 'contentDetails'] });
      if (!response.data.items) throw new Error('No results from YouTube');

      const playlist = response.data.items[0];
      return mapPlaylistResponse(playlist);
    } catch (e) {
      logger.warn(`Failed to fetch YouTube playlist: id: %s`, id);
      throw e;
    }
  }

  async getPlaylistVideos(id: string): Promise<YoutubeVideo[]> {
    let items: youtube_v3.Schema$PlaylistItem[] = [];

    try {
      logger.info(`YouTube HTTP: playlistItems.list ${id}`);
      let response = await this.youtube.playlistItems.list({ playlistId: id, part: ['id', 'snippet', 'contentDetails', 'status'] });
      items = response.data.items || [];
      while (response.data.nextPageToken) {
        logger.info(`YouTube HTTP: playlistItems.list ${id}`);
        const params = { playlistId: id, part: 'id,snippet,contentDetails', pageToken: response.data.nextPageToken };
        // @ts-ignore Typescript is dumb
        response = await this.youtube.playlistItems.list(params);
        items = items.concat(response.data.items || []);
      }
    } catch (e) {
      logger.warn(`Failed to fetch YouTube playlist: id: %s`, id);
      throw e;
    }

    return items.filter(item => item.status?.privacyStatus !== 'private' && !!item.snippet?.thumbnails?.default?.url)
      .map(mapVideoResponse);
  }

  async searchPlaylists(query: string, limit = 5): Promise<YoutubePlaylist[]> {
    try {
      logger.info(`YouTube HTTP: search.list type:playlist ${query}`);
      const response = await this.youtube.search.list({ q: query, maxResults: limit, type: ['playlist'], part: ['id', 'snippet'] });
      if (!response.data.items) return [];

      return response.data.items.map(mapPlaylistResponse);
    } catch (e) {
      logger.warn(`Failed to search YouTube playlists: query: %s`, query);
      throw e;
    }
  }

  async searchVideos(query: string, limit = 5): Promise<YoutubeVideo[]> {
    try {
      logger.info(`YouTube HTTP: search.list ${query}`);
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
      const videoResponse = response.data.items?.filter(item => item.id?.kind === 'youtube#video') ?? [];
      if (!videoResponse.length) return [];

      const videos = videoResponse.filter(video => !!video.snippet?.thumbnails?.default?.url)
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
      const sorted = await fuzzyMatch(query, videos.map(video => `${video.channelName} ${video.name}`));
      return sorted.map(scored => ({ ...mapYouTubeVideo(videos[scored.key]), score: scored.score }));
    } else {
      logger.warn(`Failed to fetch YouTube track for query: %s`, query);
    }
    return [];
  }

  private async searchSongSorted(track: Track): Promise<Track & { score: number } | undefined> {
    const videos = await this.searchSong(track.title, track.poster);
    if (videos.length > 0) {
      const video = videos.find(v =>  !MUSIC_VIDEO_PATTERN.test(v.title));
      if (video) {
        logger.info(`Searched YouTube stream '${track.poster} ${track.title}' selected '${video.url}' - Score: ${video.score}`);
        return video;
      }
    }
    return undefined;
  }

  async searchStreamVideo(track: Track): Promise<Track | undefined> {
    let video: (Track & { score: number}) | undefined;
    if (this.bing) {
      let tracks: Array<Track & { score: number}>;
      try {
        tracks = await this.bing.searchYoutubeSong(track.title, track.poster, track.duration);
        if (tracks.length === 0) {
          return undefined;
        }
      } catch (e) {
        return await this.searchSongSorted(track);
      }
      video = tracks.find(v =>  !MUSIC_VIDEO_PATTERN.test(v.title)) ?? tracks[0];
      logger.info(`Searched Bing stream '${track.poster} ${track.title}' selected '${video.url}' - Score: ${video.score}`);
      // Fallback on YouTube we get bad results
      if (video.score! < SEARCH_MIN_SCORE) {
        video = await this.searchSongSorted(track) ?? video;
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
        result = { url: video.url, live: !!video.live };
        this.cache.set(cacheId, result);
      }
    }
    return result ? new YouTubeStreamSource(result.url) : undefined;
  }

  async getStream(track: Track): Promise<StreamSource | undefined> {
    if (track.src !== SOURCE.YOUTUBE) {
      throw new Error(`Tried to get youtube readable from non-youtube resource: ${JSON.stringify(track)}`);
    }
    return new YouTubeStreamSource(track.url);
  }

}

function mapVideoResponse(video: youtube_v3.Schema$Video | youtube_v3.Schema$PlaylistItem | youtube_v3.Schema$SearchResult): YoutubeVideo {
  const thumbnails = video.snippet!.thumbnails!;
  const id = (video as youtube_v3.Schema$PlaylistItem).snippet?.resourceId?.videoId
    ?? (typeof video.id! === 'string' ? video.id! : video.id!.videoId!);
  return {
    id,
    name: decode(video.snippet!.title!),
    channelName: decode(video.snippet!.channelTitle!),
    url: `https://www.youtube.com/watch?v=${id}`,
    artwork: thumbnails.maxres?.url ?? thumbnails.standard?.url ?? thumbnails.medium?.url ?? thumbnails.default!.url!,
    isLive: (video.snippet as youtube_v3.Schema$VideoSnippet).liveBroadcastContent === 'live'
  };
}

function mapPlaylistResponse(playlist: youtube_v3.Schema$Playlist | youtube_v3.Schema$SearchResult): YoutubePlaylist {
  const id = typeof playlist.id! === 'string' ? playlist.id! : playlist.id!.playlistId!;
  return {
    id,
    name: decode(playlist.snippet!.title!),
    channelName: decode(playlist.snippet!.channelTitle!),
    videos: (playlist as youtube_v3.Schema$Playlist).contentDetails?.itemCount ?? undefined,
    url: `https://www.youtube.com/playlist?list=${id}`
  };
}

export function mapYouTubeVideo(video: YoutubeVideo): Track {
  return {
    id: video.id,
    poster: video.channelName,
    src: SOURCE.YOUTUBE,
    url: video.url,
    title: video.name,
    stream: video.url,
    artwork: video.artwork,
    live: video.isLive
  };
}

class YouTubeStreamSource implements StreamSource {

  constructor(
    private readonly url: string) {
  }

  async get(seek?: number): Promise<Readable> {
    logger.info('Getting youtube stream %s', this.url);
    const result = await play.stream(this.url, { seek });
    return result.stream;
  }

}