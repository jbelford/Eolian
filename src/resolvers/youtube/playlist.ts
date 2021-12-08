import { youtube } from 'api';
import { YoutubePlaylist } from 'api/@types';
import { mapYouTubeVideo } from 'api/youtube';
import { CommandContext, CommandOptions } from 'commands/@types';
import { MESSAGES, SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { IdentifierType } from 'data/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';


export class YouTubePlaylistResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('Missing search query for YouTube playlist.');
    }

    const playlists = await youtube.searchPlaylists(this.params.SEARCH);
    const idx = await this.context.interaction.channel.sendSelection('Choose a YouTube playlist',
      playlists.map(playlist => ({ name: playlist.name, url: playlist.url })),
      this.context.interaction.user);
    if (idx < 0) {
      throw new EolianUserError(MESSAGES.NO_SELECTION);
    }

    const playlist = playlists[idx];
    return createYouTubePlaylist(playlist);
  }
}

export function createYouTubePlaylist(playlist: YoutubePlaylist): ResolvedResource {
  return {
    name: playlist.name,
    authors: [playlist.channelName],
    identifier: {
      id: playlist.id,
      src: SOURCE.YOUTUBE,
      type: IdentifierType.PLAYLIST,
      url: playlist.url
    },
    fetcher: new YouTubePlaylistFetcher(playlist.id)
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
