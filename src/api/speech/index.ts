import { environment } from '@eolian/common/env';
import { AzureSpeechService } from './azure-speech-service';
import { OpenAiAudioService } from './openai-audio-service';
import { AIAudioTrack, IGenerativeAudioService } from './@types';
import { StreamSource } from '../@types';
import { Readable } from 'node:stream';
import { logger } from '@eolian/common/logger';

export const speechService: IGenerativeAudioService =
  OpenAiAudioService.create() ??
  new AzureSpeechService(environment.tokens.speech.key, environment.tokens.speech.region);

export class AiStreamSource implements StreamSource {
  constructor(private readonly track: AIAudioTrack) {}

  get(): Promise<Readable> {
    logger.info('Getting AI stream %s', this.track.title);
    return speechService.createSound(this.track.title, { preferLowCost: this.track.preferLowCost });
  }
}
