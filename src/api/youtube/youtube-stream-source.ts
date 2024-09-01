import { environment } from '@eolian/common/env';
import { logger } from '@eolian/common/logger';
import ytdl from '@ybd-project/ytdl-core';
import { Readable } from 'stream';
import { StreamSource } from '../@types';

export class YouTubeStreamSource implements StreamSource {

  constructor(private readonly url: string) {}

  async get(seek?: number): Promise<Readable> {
    logger.info('Getting youtube stream %s', this.url);
    const specialOptions = { poToken: environment.tokens.youtube.poToken, visitorData: environment.tokens.youtube.visitorData };
    const info = await ytdl.getInfo(this.url, specialOptions);
    const audioFormats = ytdl.filterFormats(info.formats, 'audioonly');
    return ytdl(this.url, { ...specialOptions, format: audioFormats[0] })
  }

}