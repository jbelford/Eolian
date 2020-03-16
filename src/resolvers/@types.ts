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
  fetch(identifier: Identifier): Promise<Track[]>;
}