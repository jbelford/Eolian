import { Identifier } from 'data/@types';

export interface ResolvedResource {
  authors: string[];
  name: string;
  identifier: Identifier;
}

export interface SourceResolver {

  resolve(): Promise<ResolvedResource>;

}