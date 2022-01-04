import { soundcloud } from 'api';
import { SoundCloudPlaylist, SoundCloudTrack, TrackSource } from 'api/@types';
import { mapSoundCloudTrack } from 'api/soundcloud';
import { CommandContext, CommandOptions } from 'commands/@types';
import { EolianUserError } from 'common/errors';
import { ResourceType } from 'data/@types';
import { ContextMessage } from 'framework/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';

export class SoundCloudPlaylistResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {}

  async resolve(): Promise<ResolvedResource> {
    const playlists = await this.searchSoundCloudPlaylists();
    if (playlists.length === 0) {
      throw new EolianUserError(`No SoundCloud playlists were found.`);
    }

    if (playlists.length > 1) {
      const result = await this.context.interaction.sendSelection(
        'Choose a SoundCloud playlist',
        playlists.map(playlist => ({
          name: playlist.title,
          subname: playlist.user.username,
          url: playlist.permalink_url,
        })),
        this.context.interaction.user
      );

      return createSoundCloudPlaylist(playlists[result.selected], result.message);
    } else {
      return createSoundCloudPlaylist(playlists[0]);
    }
  }

  private async searchSoundCloudPlaylists(): Promise<SoundCloudPlaylist[]> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('You must specify a SEARCH query.');
    }

    let playlists: SoundCloudPlaylist[];

    const limit = this.params.FAST ? 1 : 5;
    if (this.params.MY) {
      const user = await this.context.interaction.user.get();
      if (!user.soundcloud) {
        throw new EolianUserError(
          `I can't search your SoundCloud playlists because you haven't set your SoundCloud account yet!`
        );
      }
      playlists = await soundcloud.searchPlaylists(this.params.SEARCH, limit, user.soundcloud);
    } else {
      playlists = await soundcloud.searchPlaylists(this.params.SEARCH, limit);
    }

    return playlists;
  }

}

export function createSoundCloudPlaylist(
  playlist: SoundCloudPlaylist,
  message?: ContextMessage
): ResolvedResource {
  return {
    name: playlist.title,
    authors: [playlist.user.username],
    identifier: {
      id: playlist.id.toString(),
      src: TrackSource.SoundCloud,
      type: ResourceType.Playlist,
      url: playlist.permalink_url,
    },
    fetcher: new SoundCloudPlaylistFetcher(playlist.id, playlist),
    selectionMessage: message,
  };
}

export class SoundCloudPlaylistFetcher implements SourceFetcher {

  constructor(private readonly id: number, private readonly playlist?: SoundCloudPlaylist) {}

  async fetch(): Promise<FetchResult> {
    let tracks: SoundCloudTrack[];
    if (this.playlist && this.playlist.tracks.length === this.playlist.track_count) {
      tracks = this.playlist.tracks;
    } else {
      const playlist = await soundcloud.getPlaylist(this.id);
      tracks = playlist.tracks;
    }
    return { tracks: tracks.map(mapSoundCloudTrack) };
  }

}
