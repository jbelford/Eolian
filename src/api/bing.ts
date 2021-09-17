import { logger } from 'common/logger';
import querystring from 'querystring';
import requestp from 'request-promise-native';
import { BingApi, BingVideo } from './@types';

const BING_API = 'https://api.bing.microsoft.com/v7.0';

export class BingApiImpl implements BingApi {

  constructor(private readonly key: string, private readonly configId: string) {
  }

  async searchVideos(query: string, publisher?: string, limit = 5): Promise<BingVideo[]> {
    try {
      const response = await this.get<BingVideos>('custom/videos/search', { q: query, count: limit, pricing: 'Free', safeSearch: 'Off' });
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

  private async get<T>(path: string, params: { [key: string]: string | number | boolean } = {}): Promise<T> {
    params.customConfig = this.configId;

    const uri = `${BING_API}/${path}?${querystring.stringify(params)}`;

    logger.info(`Bing HTTP: %s`, uri);

    const headers = {
      'Ocp-Apim-Subscription-Key': this.key
    };
    const data = await requestp(uri, { headers });
    return JSON.parse(data);
  }

}

interface BingVideos {
  id: string;
  totalEstimatedMatches: number;
  value: BingVideo[];
}