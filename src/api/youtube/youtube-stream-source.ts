import { logger } from '@eolian/common/logger';
import { Readable } from 'stream';
import { StreamSource } from '../@types';
import { Innertube, UniversalCache } from 'youtubei.js';
import { createFetchFunction, createProxyUrl, generatePoToken } from './potoken';
import { httpRequest } from '@eolian/http';

const cache = new UniversalCache(true);

export class YouTubeStreamSource implements StreamSource {
  constructor(
    private readonly url: string,
    private readonly id: string,
  ) {}

  async get(seek?: number): Promise<Readable> {
    logger.info('Getting youtube stream %s - %s', this.url, this.id);

    const proxy = createProxyUrl();
    const fetch = createFetchFunction(proxy);
    const { poToken, visitorData } = await generatePoToken(fetch);

    const innertube = await Innertube.create({
      po_token: poToken,
      visitor_data: visitorData,
      cache,
      generate_session_locally: true,
      fetch,
    });

    const info = await innertube.getBasicInfo(this.id);
    const audioStreamingURL = info
      .chooseFormat({ quality: 'best', type: 'audio' })
      .decipher(innertube.session.player);
    return httpRequest(audioStreamingURL, { proxy });
  }
}
