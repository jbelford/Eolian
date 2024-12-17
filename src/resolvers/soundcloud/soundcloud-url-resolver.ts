import { soundcloud } from '@eolian/api';
import {
  SoundCloudPlaylist,
  SoundCloudResourceType,
  SoundCloudTrack,
  SoundCloudUser,
} from '@eolian/api/soundcloud/@types';
import { EolianUserError } from '@eolian/common/errors';
import { SourceResolver, ResolvedResource } from '../@types';
import { createSoundCloudUser } from './soundcloud-artist-resolver';
import { createSoundCloudPlaylist } from './soundcloud-playlist-resolver';
import { createSoundCloudSong } from './soundcloud-song-resolver';
import { TrackSource } from '@eolian/api/@types';

export class SoundCloudUrlResolver implements SourceResolver {
  public source = TrackSource.SoundCloud;

  constructor(private readonly url: string) {}

  async resolve(): Promise<ResolvedResource> {
    const resource = await soundcloud.resolve(this.url);
    switch (resource.kind) {
      case SoundCloudResourceType.PLAYLIST:
        return createSoundCloudPlaylist(resource as SoundCloudPlaylist, soundcloud);
      case SoundCloudResourceType.TRACK:
        return createSoundCloudSong(resource as SoundCloudTrack);
      case SoundCloudResourceType.USER:
        return createSoundCloudUser({ value: { user: resource as SoundCloudUser } });
      default:
        throw new EolianUserError('The SoundCloud URL is not valid!');
    }
  }
}
