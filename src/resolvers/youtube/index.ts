import { CommandOptions } from '@eolian/command-options/@types';
import { CommandContext } from '@eolian/commands/@types';
import { Identifier, ResourceType } from '@eolian/data/@types';
import { SourceFetcher } from '../@types';
import { YouTubePlaylistFetcher } from './youtube-playlist-resolver';
import { YouTubeVideoFetcher } from './youtube-video-resolver';

export { YouTubePlaylistResolver } from './youtube-playlist-resolver';
export { YouTubeUrlResolver } from './youtube-url-resolver';
export { YouTubeVideoResolver } from './youtube-video-resolver';

export function getYouTubeSourceFetcher(
  identifier: Identifier,
  context: CommandContext,
  params: CommandOptions,
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
