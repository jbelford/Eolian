import { soundcloud } from 'api';
import { SoundCloudPlaylist, SoundCloudTrack } from 'api/@types';
import { mapSoundCloudTrack } from 'api/soundcloud';
import { CommandContext, CommandOptions } from 'commands/@types';
import { MESSAGES, SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { IdentifierType } from 'data/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';

export class SoundCloudPlaylistResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    const playlists = await this.searchSoundCloudPlaylists();
    if (playlists.length === 0) {
      throw new EolianUserError(`No SoundCloud playlists were found.`);
    }

    let playlist = playlists[0];
    if (playlists.length > 1) {
      const idx = await this.context.channel.sendSelection('Choose a SoundCloud playlist',
        playlists.map(playlist => ({ name: playlist.title, subname: playlist.user.username, url: playlist.permalink_url })),
        this.context.user);
      if (idx < 0) {
        throw new EolianUserError(MESSAGES.NO_SELECTION);
      }
      playlist = playlists[idx];
    }

    return createSoundCloudPlaylist(playlist);
  }

  private async searchSoundCloudPlaylists(): Promise<SoundCloudPlaylist[]> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('You must specify a SEARCH query.');
    }

    let playlists: SoundCloudPlaylist[];

    if (this.params.MY) {
      const user = await this.context.user.get();
      if (!user.soundcloud) {
        throw new EolianUserError(`I can't search your SoundCloud playlists because you haven't set your SoundCloud account yet!`);
      }
      playlists = await soundcloud.searchPlaylists(this.params.SEARCH, user.soundcloud);
    } else {
      playlists = await soundcloud.searchPlaylists(this.params.SEARCH);
    }

    return playlists;
  }
}

export function createSoundCloudPlaylist(playlist: SoundCloudPlaylist): ResolvedResource {
  return {
    name: playlist.title,
    authors: [playlist.user.username],
    identifier: {
      id: playlist.id.toString(),
      src: SOURCE.SOUNDCLOUD,
      type: IdentifierType.PLAYLIST,
      url: playlist.permalink_url
    },
    fetcher: new SoundCloudPlaylistFetcher(playlist.id, playlist)
  };
}

export class SoundCloudPlaylistFetcher implements SourceFetcher {

  constructor(private readonly id: number,
    private readonly playlist?: SoundCloudPlaylist) {
  }

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
