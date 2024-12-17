import { Readable } from 'node:stream';
import { ISpeechService } from './@types';
import OpenAI, { AzureOpenAI } from 'openai';
import { environment } from '@eolian/common/env';

export class OpenAiSpeechService implements ISpeechService {
  private constructor(private readonly openai: OpenAI) {}

  async textToSpeech(text: string): Promise<Readable> {
    const response = await this.openai.audio.speech.create({
      model: 'tts-1',
      voice: 'fable',
      input: text,
      response_format: 'opus',
    });

    if (!response.body) {
      throw new Error('Failed to receive audio response from OpenAI');
    }

    return response.body as any;
  }

  static create(): ISpeechService | undefined {
    let openai: OpenAI | undefined;

    if (environment.tokens.azureOpenAi) {
      openai = new AzureOpenAI({
        ...environment.tokens.azureOpenAi,
      });
    } else if (environment.tokens.openai) {
      openai = new OpenAI({
        apiKey: environment.tokens.openai,
      });
    }

    return openai ? new OpenAiSpeechService(openai) : undefined;
  }
}
