import { CommandOptions } from 'commands/@types';
import { ResourceType } from 'data/@types';
import { ContextSendable } from 'framework/@types';
import { SourceFetcher } from 'resolvers/@types';
import { YouTubePlaylistFetcher } from './playlist';
import { YouTubeVideoFetcher } from './video';

export { YouTubePlaylistResolver } from './playlist';
export { YouTubeUrlResolver } from './url';
export { YouTubeVideoResolver } from './video';

export function getYouTubeSourceFetcher(
  id: string,
  type: ResourceType,
  params: CommandOptions,
  sendable: ContextSendable
): SourceFetcher {
  switch (type) {
    case ResourceType.Playlist:
      return new YouTubePlaylistFetcher(id, params, sendable);
    case ResourceType.Song:
      return new YouTubeVideoFetcher(id);
    default:
      throw new Error('Invalid type for YouTube fetcher');
  }
}
