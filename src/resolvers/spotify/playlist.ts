import { spotify, youtube } from 'api';
import {
  RangeFactory,
  SpotifyApi,
  SpotifyPlaylist,
  SpotifyPlaylistTracks,
  TrackSource,
} from 'api/@types';
import { mapSpotifyTrack, SpotifyApiImpl } from 'api/spotify';
import { CommandContext, CommandOptions } from 'commands/@types';
import { getRangeOption } from 'commands/patterns';
import { EolianUserError } from 'common/errors';
import { feature } from 'data';
import { FeatureFlag, ResourceType } from 'data/@types';
import { DownloaderDisplay } from 'framework';
import { ContextMessage, ContextSendable } from 'framework/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';

export class SpotifyPlaylistResolver implements SourceResolver {

  private client: SpotifyApi = spotify;

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {}

  async resolve(): Promise<ResolvedResource> {
    const playlists = await this.searchSpotifyPlaylists();
    if (playlists.length === 0) {
      throw new EolianUserError(`No Spotify playlists were found.`);
    }

    if (playlists.length > 1) {
      const result = await this.context.interaction.sendSelection(
        'Choose a Spotify playlist',
        playlists.map(playlist => ({
          name: playlist.name,
          subname: playlist.owner.display_name,
          url: playlist.external_urls.spotify,
        })),
        this.context.interaction.user
      );

      return createSpotifyPlaylist(
        this.client,
        playlists[result.selected],
        this.params,
        this.context.interaction.channel,
        result.message
      );
    } else {
      return createSpotifyPlaylist(
        this.client,
        playlists[0],
        this.params,
        this.context.interaction.channel
      );
    }
  }

  private async searchSpotifyPlaylists(): Promise<SpotifyPlaylist[]> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('You must specify a search query.');
    }

    let playlists: SpotifyPlaylist[];

    const limit = this.params.FAST ? 1 : 5;
    if (this.params.MY) {
      if (feature.enabled(FeatureFlag.SPOTIFY_AUTH)) {
        const request = await this.context.interaction.user.getSpotifyRequest();
        this.client = new SpotifyApiImpl(youtube, request);

        playlists = await this.client.searchMyPlaylists(this.params.SEARCH, limit);
      } else {
        const user = await this.context.interaction.user.get();
        if (!user.spotify) {
          throw new EolianUserError(
            `I can't search your Spotify playlists because you haven't set your Spotify account yet!`
          );
        }
        playlists = await this.client.searchPlaylists(this.params.SEARCH, limit, user.spotify);
      }
    } else {
      playlists = await this.client.searchPlaylists(this.params.SEARCH, limit);
    }

    return playlists;
  }

}

export function createSpotifyPlaylist(
  client: SpotifyApi,
  playlist: SpotifyPlaylist,
  params: CommandOptions,
  sendable: ContextSendable,
  message?: ContextMessage
): ResolvedResource {
  return {
    name: playlist.name,
    authors: [playlist.owner.display_name || '<unknown>'],
    identifier: {
      id: playlist.id,
      src: TrackSource.Spotify,
      type: ResourceType.Playlist,
      url: playlist.external_urls.spotify,
      auth: spotify !== client,
    },
    fetcher: new SpotifyPlaylistFetcher(playlist.id, params, sendable, client, playlist),
    selectionMessage: message,
  };
}

export class SpotifyPlaylistFetcher implements SourceFetcher {

  constructor(
    private readonly id: string,
    private readonly params: CommandOptions,
    private readonly sendable: ContextSendable,
    private readonly client: SpotifyApi,
    private readonly playlist?: SpotifyPlaylist
  ) {}

  async fetch(): Promise<FetchResult> {
    let playlist: SpotifyPlaylistTracks;
    let rangeOptimized = false;

    if (
      this.playlist?.tracks.items
      && this.playlist.tracks.total === this.playlist.tracks.items.length
    ) {
      playlist = this.playlist as SpotifyPlaylistTracks;
    } else {
      const rangeFn: RangeFactory = total => getRangeOption(this.params, total);
      const progress = new DownloaderDisplay(this.sendable, 'Fetching playlist tracks');

      playlist = await this.client.getPlaylistTracks(this.id, progress, rangeFn);

      rangeOptimized = true;
    }

    const defaultForLocals = playlist.images.length ? playlist.images[0].url : undefined;
    const tracks = playlist.tracks.items
      .filter(item => !!item.track)
      .map(item => mapSpotifyTrack(item.track!, undefined, defaultForLocals));
    return { tracks, rangeOptimized };
  }

}
