import { CommandContext, CommandOptions } from 'commands/@types';
import { Identifier, ResourceType } from 'data/@types';
import { SourceFetcher } from 'resolvers/@types';
import { YouTubePlaylistFetcher } from './playlist';
import { YouTubeVideoFetcher } from './video';

export { YouTubePlaylistResolver } from './playlist';
export { YouTubeUrlResolver } from './url';
export { YouTubeVideoResolver } from './video';

export function getYouTubeSourceFetcher(
  identifier: Identifier,
  context: CommandContext,
  params: CommandOptions
): SourceFetcher {
  switch (identifier.type) {
    case ResourceType.Playlist:
      return new YouTubePlaylistFetcher(identifier.id, params, context.interaction);
    case ResourceType.Song:
      return new YouTubeVideoFetcher(identifier.id);
    default:
      throw new Error('Invalid type for YouTube fetcher');
  }
}
