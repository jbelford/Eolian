import { spotify } from 'api';
import { RangeFactory, SpotifyPlaylist, SpotifyPlaylistTracks } from 'api/@types';
import { mapSpotifyTrack } from 'api/spotify';
import { CommandContext, CommandOptions } from 'commands/@types';
import { getRangeOption } from 'commands/patterns';
import { SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { IdentifierType } from 'data/@types';
import { DownloaderDisplay } from 'framework';
import { ContextMessage, ContextSendable } from 'framework/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';


export class SpotifyPlaylistResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    const playlists = await this.searchSpotifyPlaylists();
    if (playlists.length === 0) {
      throw new EolianUserError(`No Spotify playlists were found.`);
    }

    if (playlists.length > 1) {
      const result = await this.context.interaction.sendSelection('Choose a Spotify playlist',
        playlists.map(playlist => ({ name: playlist.name, subname: playlist.owner.display_name, url: playlist.external_urls.spotify })),
        this.context.interaction.user);

      return createSpotifyPlaylist(playlists[result.selected], this.params, this.context.interaction.channel, result.message);
    } else {
      return createSpotifyPlaylist(playlists[0], this.params, this.context.interaction.channel);
    }
  }

  private async searchSpotifyPlaylists(): Promise<SpotifyPlaylist[]> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('You must specify a search query.');
    }

    let playlists: SpotifyPlaylist[];

    if (this.params.MY) {
      const user = await this.context.interaction.user.get();
      if (!user.spotify) {
        throw new EolianUserError(`I can't search your Spotify playlists because you haven't set your Spotify account yet!`);
      }
      playlists = await spotify.searchPlaylists(this.params.SEARCH, user.spotify);
    } else {
      playlists = await spotify.searchPlaylists(this.params.SEARCH);
    }

    return playlists;
  }

}

export function createSpotifyPlaylist(playlist: SpotifyPlaylist, params: CommandOptions, sendable: ContextSendable, message?: ContextMessage): ResolvedResource {
  return {
    name: playlist.name,
    authors: [playlist.owner.display_name || '<unknown>'],
    identifier: {
      id: playlist.id,
      src: SOURCE.SPOTIFY,
      type: IdentifierType.PLAYLIST,
      url: playlist.external_urls.spotify
    },
    fetcher: new SpotifyPlaylistFetcher(playlist.id, params, sendable, playlist),
    selectionMessage: message
  };
}

export class SpotifyPlaylistFetcher implements SourceFetcher {

  constructor(private readonly id: string,
    private readonly params: CommandOptions,
    private readonly sendable: ContextSendable,
    // @ts-ignore
    private readonly playlist?: SpotifyPlaylist) {
  }

  async fetch(): Promise<FetchResult> {
    let playlist: SpotifyPlaylistTracks;
    let rangeOptimized = false;

    if (this.playlist?.tracks.items && this.playlist.tracks.total === this.playlist.tracks.items.length) {
      playlist = this.playlist as SpotifyPlaylistTracks;
    } else {
      const rangeFn: RangeFactory = total => getRangeOption(this.params, total);
      const progress = new DownloaderDisplay(this.sendable, 'Fetching playlist tracks');

      playlist = await spotify.getPlaylistTracks(this.id, progress, rangeFn);

      rangeOptimized = true;
    }

    const defaultForLocals = playlist.images.length ? playlist.images[0].url : undefined;
    const tracks = playlist.tracks.items.filter(item => !!item.track).map(item => mapSpotifyTrack(item.track!, undefined, defaultForLocals));
    return { tracks, rangeOptimized };
  }

}
