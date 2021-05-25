import { Identifier } from 'data/@types';
import { Track } from 'music/@types';

export interface ResolvedResource {
  authors: string[];
  name: string;
  identifier: Identifier;
  tracks?: Track[];
}

export interface SourceResolver {
  resolve(): Promise<ResolvedResource>;
}

export interface SourceFetcher {
  fetch(): Promise<FetchResult>;
}

export type FetchResult = {
  tracks: Track[],
  // Whether range params will be considered while fetching and already applied to the result
  rangeOptimized?: boolean
};