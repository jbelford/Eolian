import { Readable } from 'node:stream';
import { IAudioOptions, IGenerativeAudioService } from './@types';
import OpenAI, { AzureOpenAI } from 'openai';
import { environment } from '@eolian/common/env';

type IOpenAiAudioConfig = {
  ttsModel?: string;
  audioModel?: string;
  audioModelMini?: string;
};

const CREATE_SOUND_SYSTEM_PROMPT = `You are an AI assistant that generates an audio output only.\
 For the given user input, speak out an imitation of that sound using human language.\
 Repeat the imitation multiple times if necessary. Audio should be no longer than 30 seconds.`;

export class OpenAiAudioService implements IGenerativeAudioService {
  private constructor(
    private readonly openai: OpenAI,
    private readonly config: IOpenAiAudioConfig = {},
  ) {}

  async textToSpeech(text: string): Promise<Readable> {
    if (text.length > 4096) {
      throw new Error('Text cannot be longer than 4096 characters!');
    }

    const response = await this.openai.audio.speech.create({
      model: this.config?.ttsModel || 'tts-1',
      voice: 'fable',
      input: text,
      response_format: 'opus',
    });

    if (!response.body) {
      throw new Error('Failed to receive audio response from OpenAI');
    }

    return response.body as any;
  }

  async createSound(sound: string, options?: IAudioOptions): Promise<Readable> {
    const response = await this.openai.chat.completions.create({
      model: options?.preferLowCost
        ? this.config?.audioModelMini || 'gpt-4o-mini-audio-preview'
        : this.config?.audioModel || 'gpt-4o-audio-preview-2024-12-17',
      modalities: ['text', 'audio'],
      audio: {
        format: 'opus',
        voice: 'ash',
      },
      messages: [
        {
          role: 'system',
          content: CREATE_SOUND_SYSTEM_PROMPT,
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
    let config: IOpenAiAudioConfig = {};

    if (environment.tokens.azureOpenAi) {
      openai = new AzureOpenAI({
        ...environment.tokens.azureOpenAi,
      });
    } else if (environment.tokens.openai) {
      openai = new OpenAI({
        apiKey: environment.tokens.openai.apiKey,
      });
      config = {
        ttsModel: environment.tokens.openai.ttsModel,
        audioModel: environment.tokens.openai.audioModel,
      };
    }

    return openai ? new OpenAiAudioService(openai, config) : undefined;
  }
}
