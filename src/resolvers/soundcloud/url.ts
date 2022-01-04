import { soundcloud } from 'api';
import {
  SoundCloudPlaylist,
  SoundCloudResourceType,
  SoundCloudTrack,
  SoundCloudUser
} from 'api/@types';
import { EolianUserError } from 'common/errors';
import { ResolvedResource, SourceResolver } from '../@types';
import { createSoundCloudUser } from './artist';
import { createSoundCloudPlaylist } from './playlist';
import { createSoundCloudSong } from './song';

export class SoundCloudUrlResolver implements SourceResolver {

  constructor(private readonly url: string) {}

  async resolve(): Promise<ResolvedResource> {
    const resource = await soundcloud.resolve(this.url);
    switch (resource.kind) {
      case SoundCloudResourceType.PLAYLIST:
        return createSoundCloudPlaylist(resource as SoundCloudPlaylist);
      case SoundCloudResourceType.TRACK:
        return createSoundCloudSong(resource as SoundCloudTrack);
      case SoundCloudResourceType.USER:
        return createSoundCloudUser({ value: resource as SoundCloudUser });
      default:
        throw new EolianUserError('The SoundCloud URL is not valid!');
    }
  }

}
