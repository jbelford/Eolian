import { logger } from 'common/logger';
import { httpRequest } from 'common/request';
import { fuzzyMatch } from 'common/util';
import { parse, toSeconds } from 'iso8601-duration';
import { BingApi, BingVideo, Track, TrackSource } from './@types';

const BING_API = 'https://api.bing.microsoft.com/v7.0';

export class BingApiImpl implements BingApi {
  constructor(private readonly key: string, private readonly configId: string) {}

  async searchVideos(query: string, publisher?: string, limit = 5): Promise<BingVideo[]> {
    try {
      const response = await this.get<BingVideos>('custom/videos/search', {
        q: query,
        count: limit,
        pricing: 'Free',
        safeSearch: 'Off',
      });
      if (publisher) {
        return response.value
          .filter(video => !!video.creator)
          .filter(video => video.publisher.length === 1 && video.publisher[0].name === publisher);
      } else {
        return response.value.filter(video => !!video.creator);
      }
    } catch (e) {
      logger.warn('Failed to search Bing videos: %s\n%s', query, e);
      throw e;
    }
  }

  async searchYoutubeSong(
    name: string,
    artist: string,
    duration?: number
  ): Promise<(Track & { score: number })[]> {
    const query = `${artist} ${name}`;
    const videos = await this.searchVideos(query, 'YouTube', 15);
    if (videos.length) {
      const sorted = await fuzzyMatch(
        query,
        videos.map(video => `${video.creator.name} ${video.name}`)
      );
      if (duration) {
        sorted.sort((a, b) => {
          if (Math.abs(a.score - b.score) > 2) {
            return b.score - a.score;
          }
          const durationA = toSeconds(parse(videos[a.key].duration)) * 1000;
          const durationB = toSeconds(parse(videos[b.key].duration)) * 1000;
          return Math.abs(durationA - duration) - Math.abs(durationB - duration);
        });
      }
      return sorted
        .map(scored => ({ ...videos[scored.key], score: scored.score }))
        .map(video => ({
          id: video.id,
          poster: video.creator.name,
          src: TrackSource.YouTube,
          url: video.contentUrl,
          title: video.name,
          stream: video.contentUrl,
          score: video.score,
        }));
    } else {
      logger.warn(`Failed to fetch YouTube track for query: %s`, query);
    }
    return [];
  }

  private async get<T>(
    path: string,
    params: { [key: string]: string | number | boolean } = {}
  ): Promise<T> {
    params.customConfig = this.configId;

    const uri = `${BING_API}/${path}`;

    logger.info(`Bing HTTP: %s`, uri);

    const headers = {
      'Ocp-Apim-Subscription-Key': this.key,
    };
    return await httpRequest<T>(uri, { params, headers, json: true });
  }
}

interface BingVideos {
  id: string;
  totalEstimatedMatches: number;
  value: BingVideo[];
}
