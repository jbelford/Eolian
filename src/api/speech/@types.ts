import { Readable } from 'stream';

export interface ISpeechService {
  textToSpeech(text: string): Promise<Readable>;
}
