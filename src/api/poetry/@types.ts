import { StreamFetcher, Track } from '../@types';

export type SearchOptions = {
  random?: boolean;
  limit?: number;
};

export interface IPoetryApi extends StreamFetcher {
  getPoem(id: string): Promise<Poem | undefined>;
  searchPoems(title?: string, author?: string, options?: SearchOptions): Promise<Poem[]>;
  getPoemUrl(poem: Poem): string;
}

export type Poem = {
  title: string;
  author: string;
  lines: string[];
  linecount: number;
};

export type PoetryTrack = Track & {
  lines: string[];
};
