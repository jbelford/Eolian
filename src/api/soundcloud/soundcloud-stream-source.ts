import { logger } from '@eolian/common/logger';
import { IOAuthHttpClient } from '@eolian/http/@types';
import { Readable } from 'stream';
import { StreamSource } from '../@types';

export class SoundCloudStreamSource implements StreamSource {
  constructor(
    private readonly req: IOAuthHttpClient,
    private readonly url: string,
    private readonly stream: string,
  ) {}

  get(): Promise<Readable> {
    logger.info('Getting soundcloud stream %s', this.url);
    return this.req.getStream(this.stream);
  }
}
