import { Identifier, ResourceType } from '@eolian/data/@types';
import { SourceFetcher } from '../@types';
import { PoetryFetcher } from './poetry-resolver';

export { PoetryResolver } from './poetry-resolver';

export function getPoetrySourceFetcher(identifier: Identifier): SourceFetcher {
  switch (identifier.type) {
    case ResourceType.Song:
      return new PoetryFetcher(identifier.id);
    default:
      throw new Error('Invalid type for Poetry fetcher');
  }
}
