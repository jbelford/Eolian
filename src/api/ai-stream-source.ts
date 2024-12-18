import { Readable } from 'node:stream';
import { StreamSource, Track } from './@types';
import { logger } from '@eolian/common/logger';
import { speechService } from './speech';

export class AiStreamSource implements StreamSource {
  constructor(private readonly track: Track) {}

  get(): Promise<Readable> {
    logger.info('Getting AI stream %s', this.track.title);
    return speechService.createSound(this.track.title);
  }
}
