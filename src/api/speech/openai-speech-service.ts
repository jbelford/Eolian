import { Readable } from 'node:stream';
import { IGenerativeAudioService } from './@types';
import OpenAI, { AzureOpenAI } from 'openai';
import { environment } from '@eolian/common/env';

export class OpenAiSpeechService implements IGenerativeAudioService {
  private constructor(private readonly openai: OpenAI) {}

  async textToSpeech(text: string): Promise<Readable> {
    if (text.length > 4096) {
      throw new Error('Text cannot be longer than 4096 characters!');
    }

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

  async createSound(sound: string): Promise<Readable> {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-audio-preview',
      modalities: ['text', 'audio'],
      audio: {
        format: 'opus',
        voice: 'ash',
      },
      messages: [
        {
          role: 'system',
          content:
            'You are an AI assistant that generates an audio output only. For the given user input, speak out an immitation of that sound using human language. Repeat the immitation multiple times if necessary.',
        },
        {
          role: 'user',
          content: sound,
        },
      ],
    });

    const audioData =
      response.choices.length > 0 ? response.choices[0].message.audio?.data : undefined;
    if (!audioData) {
      throw new Error('Failed to receive audio response from OpenAI');
    }

    return Readable.from(Buffer.from(audioData, 'base64'));
  }

  static create(): IGenerativeAudioService | undefined {
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
