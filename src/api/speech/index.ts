import { environment } from '@eolian/common/env';
import { AzureSpeechService } from './azure-speech-service';
import { OpenAiSpeechService } from './openai-speech-service';
import { ISpeechService } from './@types';

export const speechService: ISpeechService =
  OpenAiSpeechService.create()
  ?? new AzureSpeechService(
    environment.tokens.speech.key,
    environment.tokens.speech.region
  );