import { environment } from '@eolian/common/env';
import { logger } from '@eolian/common/logger';
import ytdl from '@ybd-project/ytdl-core';
import { Readable } from 'stream';
import { StreamSource } from '../@types';
// @ts-ignore
import { generate } from 'youtube-po-token-generator';

let { poToken, visitorData } = environment.tokens.youtube;

export class YouTubeStreamSource implements StreamSource {

  constructor(private readonly url: string) {}

  async get(seek?: number): Promise<Readable> {
    logger.info('Getting youtube stream %s', this.url);

    if (!poToken || !visitorData) {
      const newToken = await generate();
      poToken = newToken.poToken;
      visitorData = newToken.visitorData;
      logger.info('Generated new PoToken\nTOKEN %s\nVISITORDATA %s\n', poToken, visitorData);
    }

    const info = await ytdl.getInfo(this.url, { poToken, visitorData, });
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    return ytdl(this.url, { poToken, visitorData, format: audioFormats[0] })
  }

}