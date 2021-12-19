import { IdentifierType } from 'data/@types';
import { ContextSendable } from 'framework/@types';
import { SourceFetcher } from 'resolvers/@types';
import { YouTubePlaylistFetcher } from './playlist';
import { YouTubeVideoFetcher } from './video';

export { YouTubePlaylistResolver } from './playlist';
export { YouTubeUrlResolver } from './url';
export { YouTubeVideoResolver } from './video';

export function getYouTubeSourceFetcher(id: string, type: IdentifierType, sendable: ContextSendable): SourceFetcher {
  switch (type) {
    case IdentifierType.PLAYLIST:
      return new YouTubePlaylistFetcher(id, sendable);
    case IdentifierType.SONG:
      return new YouTubeVideoFetcher(id);
    default:
      throw new Error('Invalid type for YouTube fetcher');
  }
}