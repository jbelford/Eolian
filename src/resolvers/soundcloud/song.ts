import { soundcloud } from 'api';
import { SoundCloudTrack } from 'api/@types';
import { mapSoundCloudTrack } from 'api/soundcloud';
import { CommandContext, CommandOptions } from 'commands/@types';
import { MESSAGES, SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { IdentifierType } from 'data/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';

export class SoundCloudSongResolver implements SourceResolver {
  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('Missing SEARCH query for SoundCloud song.');
    }

    const songs = await soundcloud.searchSongs(this.params.SEARCH);
    const idx = await this.context.interaction.channel.sendSelection('Choose a SoundCloud track',
      songs.map(song =>  ({ name: song.title, url: song.permalink_url })),
      this.context.interaction.user);
    if (idx < 0) {
      throw new EolianUserError(MESSAGES.NO_SELECTION);
    }

    return createSoundCloudSong(songs[idx]);
  }
}

export function createSoundCloudSong(track: SoundCloudTrack): ResolvedResource {
  return {
    name: track.title,
    authors: [track.user.username],
    identifier: {
      id: track.id.toString(),
      src: SOURCE.SOUNDCLOUD,
      type: IdentifierType.SONG,
      url: track.permalink_url
    },
    fetcher: new SoundCloudSongFetcher(track.id, track)
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