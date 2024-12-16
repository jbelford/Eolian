import { environment } from '@eolian/common/env';
import { AzureSpeechService } from './azure-speech-service';
import { OpenAiSpeechService } from './openai-speech-service';

export const speechService = environment.tokens.openai
  ? new OpenAiSpeechService()
  : new AzureSpeechService(
    environment.tokens.speech.key,
    environment.tokens.speech.region
  );