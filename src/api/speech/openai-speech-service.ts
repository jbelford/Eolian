import { Readable } from 'stream';
import { ISpeechService } from './@types';
import OpenAI from 'openai';
import { environment } from '@eolian/common/env';

export class OpenAiSpeechService implements ISpeechService {
  private readonly openai = new OpenAI({ apiKey: environment.tokens.openai });

  async textToSpeech(text: string): Promise<Readable> {
    const mp3 = await this.openai.audio.speech.create({
      model: 'tts-1',
      voice: 'fable',
      input: text,
      response_format: 'opus',
    });

    if (!mp3.body) {
      throw new Error('Failed to receive audio response from OpenAI');
    }

    return mp3.body as any;
  }

}