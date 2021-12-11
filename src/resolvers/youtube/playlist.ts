import { youtube } from 'api';
import { YoutubePlaylist } from 'api/@types';
import { mapYouTubeVideo } from 'api/youtube';
import { CommandContext, CommandOptions } from 'commands/@types';
import { SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { IdentifierType } from 'data/@types';
import { ContextMessage } from 'framework/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';


export class YouTubePlaylistResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('Missing search query for YouTube playlist.');
    }

    const playlists = await youtube.searchPlaylists(this.params.SEARCH);
    const result = await this.context.interaction.sendSelection('Choose a YouTube playlist',
      playlists.map(playlist => ({ name: playlist.name, url: playlist.url })),
      this.context.interaction.user);

    return createYouTubePlaylist(playlists[result.selected], result.message);
  }
}

export function createYouTubePlaylist(playlist: YoutubePlaylist, message?: ContextMessage): ResolvedResource {
  return {
    name: playlist.name,
    authors: [playlist.channelName],
    identifier: {
      id: playlist.id,
      src: SOURCE.YOUTUBE,
      type: IdentifierType.PLAYLIST,
      url: playlist.url
    },
    fetcher: new YouTubePlaylistFetcher(playlist.id),
    selectionMessage: message
  };
}

export class YouTubePlaylistFetcher implements SourceFetcher {

  constructor(private readonly id: string) {
  }

  async fetch(): Promise<FetchResult> {
    const videos = await youtube.getPlaylistVideos(this.id);
    return { tracks: videos.map(mapYouTubeVideo) };
  }

}
