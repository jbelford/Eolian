import { environment } from '@eolian/common/env';
import { AzureSpeechService } from './azure-speech-service';
import { OpenAiSpeechService } from './openai-speech-service';
import { IGenerativeAudioService } from './@types';

export const speechService: IGenerativeAudioService =
  OpenAiSpeechService.create() ??
  new AzureSpeechService(environment.tokens.speech.key, environment.tokens.speech.region);
