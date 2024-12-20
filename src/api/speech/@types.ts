import { Readable } from 'stream';
import { Track } from '../@types';

export type IAudioOptions = {
  preferLowCost?: boolean;
};

export interface IGenerativeAudioService {
  textToSpeech(text: string): Promise<Readable>;
  createSound(sound: string, options?: IAudioOptions): Promise<Readable>;
}

export type AIAudioTrack = Track & {
  preferLowCost?: boolean;
};
