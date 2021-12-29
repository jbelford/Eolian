import { soundcloud } from 'api';
import { SoundCloudTrack, TrackSource } from 'api/@types';
import { mapSoundCloudTrack } from 'api/soundcloud';
import { CommandContext, CommandOptions } from 'commands/@types';
import { EolianUserError } from 'common/errors';
import { IdentifierType } from 'data/@types';
import { ContextMessage } from 'framework/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';

export class SoundCloudSongResolver implements SourceResolver {
  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('Missing SEARCH query for SoundCloud song.');
    }

    const songs = await soundcloud.searchSongs(this.params.SEARCH, this.params.FAST ? 1 : 5);
    if (songs.length === 0) {
      throw new EolianUserError('No SoundCloud songs were found.');
    } else if (songs.length === 1) {
      return createSoundCloudSong(songs[0]);
    } else {
      const result = await this.context.interaction.sendSelection('Choose a SoundCloud track',
        songs.map(song =>  ({ name: song.title, url: song.permalink_url })),
        this.context.interaction.user);

      return createSoundCloudSong(songs[result.selected], result.message);
    }
  }
}

export function createSoundCloudSong(track: SoundCloudTrack, message?: ContextMessage): ResolvedResource {
  return {
    name: track.title,
    authors: [track.user.username],
    identifier: {
      id: track.id.toString(),
      src: TrackSource.SoundCloud,
      type: IdentifierType.SONG,
      url: track.permalink_url
    },
    fetcher: new SoundCloudSongFetcher(track.id, track),
    selectionMessage: message
  }
}

export class SoundCloudSongFetcher implements SourceFetcher {

  constructor(private readonly id: number,
    private readonly track?: SoundCloudTrack) {
  }

  async fetch(): Promise<FetchResult> {
    const track = this.track ? this.track : await soundcloud.getTrack(this.id);
    return { tracks: [mapSoundCloudTrack(track)], rangeOptimized: true };
  }

}