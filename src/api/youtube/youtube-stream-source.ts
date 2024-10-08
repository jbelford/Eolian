import { logger } from '@eolian/common/logger';
import { YTDL_NodejsStreamType, YtdlCore } from '@ybd-project/ytdl-core';
import { Readable } from 'stream';
import { StreamSource } from '../@types';
// @ts-ignore
import { generate } from 'youtube-po-token-generator';

const ytdl = new YtdlCore();

export class YouTubeStreamSource implements StreamSource {

  constructor(private readonly url: string) {}

  async get(seek?: number): Promise<Readable> {
    logger.info('Getting youtube stream %s', this.url);

    const info = await ytdl.getFullInfo(this.url);
    const audioFormats = info.formats.filter(format => format.hasAudio && !format.hasVideo);
    const stream = await ytdl.downloadFromInfo<YTDL_NodejsStreamType>(info, { format: audioFormats[0], streamType: 'nodejs' });
    return stream as Readable;
  }

}