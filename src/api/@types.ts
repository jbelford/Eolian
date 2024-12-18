import { AbsRangeArgument } from '@eolian/common/@types';
import { Color } from '@eolian/common/constants';
import { Readable } from 'stream';

export interface StreamFetcher {
  getStream(track: Track): Promise<StreamSource | undefined>;
}

export type RangeFactory = (total: number) => AbsRangeArgument | undefined;

export const enum TrackSource {
  Unknown = 0,
  Spotify,
  YouTube,
  SoundCloud,
  Poetry,
  AI,
}

export type TrackSourceDetails = {
  name: string;
  color: Color;
  icon?: string;
};

export interface Track {
  readonly id?: string;
  readonly title: string;
  readonly poster: string;
  readonly url: string;
  readonly stream?: string;
  readonly artwork?: string;
  readonly src: TrackSource;
  readonly duration?: number;
  readonly live?: boolean;
  readonly ai?: boolean;
}

export interface StreamSource {
  get(seek?: number): Promise<Readable>;
}
