import { Readable } from 'stream';
import { Track } from '../@types';

export type IAudioOptions = {
  preferLowCost?: boolean;
  voice?: number;
};

export interface IGenerativeAudioService {
  textToSpeech(text: string): Promise<Readable>;
  createSound(sound: string, options?: IAudioOptions): Promise<Readable>;
}

export type AIAudioTrack = Track & {
  preferLowCost?: boolean;
  voice?: number;
};
