import { Track } from '@eolian/api/@types';
import { Identifier } from '@eolian/data/@types';
import { ContextMessage } from '@eolian/framework/@types';

export interface ResolvedResource {
  authors: string[];
  name: string;
  identifier: Identifier;
  fetcher: SourceFetcher;
  selectionMessage?: ContextMessage;
}

export interface SourceResolver {
  resolve(): Promise<ResolvedResource>;
}

export interface SourceFetcher {
  fetch(): Promise<FetchResult>;
}

export type FetchResult = {
  tracks: Track[];
  // Whether range params will be considered while fetching and already applied to the result
  rangeOptimized?: boolean;
};

export type MessageBundledResult<T> = {
  value: T;
  message?: ContextMessage;
};

export type ResourceTypeDetails = {
  name: string;
};
