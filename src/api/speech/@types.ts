import { Readable } from 'stream';

export interface IGenerativeAudioService {
  textToSpeech(text: string): Promise<Readable>;
  createSound(sound: string): Promise<Readable>;
}
