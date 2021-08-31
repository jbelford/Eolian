import { soundcloud } from 'api';
import { SoundCloudUser } from 'api/@types';
import { mapSoundCloudTrack } from 'api/soundcloud';
import { CommandOptions } from 'commands/@types';
import { getRangeOption } from 'commands/keywords';
import { ProgressUpdater } from 'common/@types';
import { SOURCE } from 'common/constants';
import { IdentifierType } from 'data/@types';
import { DownloaderDisplay } from 'framework';
import { ContextTextChannel } from 'framework/@types';
import { FetchResult, ResolvedResource, SourceFetcher } from 'resolvers/@types';
import { SoundCloudArtistResolver } from './artist';

export class SoundCloudFavoritesResolver extends SoundCloudArtistResolver {
  async resolve(): Promise<ResolvedResource> {
    const user = await this.getSoundCloudUser();
    return createSoundCloudLikes(user, this.params, this.context.channel);
  }
}

export function createSoundCloudLikes(
    user: SoundCloudUser,
    params: CommandOptions,
    channel: ContextTextChannel): ResolvedResource {
  return {
    name: 'Liked Tracks',
    authors: [user.username],
    identifier: {
      id: user.id.toString(),
      src: SOURCE.SOUNDCLOUD,
      type: IdentifierType.LIKES,
      url: `${user.permalink_url}/likes`
    },
    fetcher: new SoundCloudFavoritesFetcher(user.id, params, channel, user)
  };
}


export class SoundCloudFavoritesFetcher implements SourceFetcher {

  constructor(private readonly id: number,
    private readonly params: CommandOptions,
    private readonly channel: ContextTextChannel,
    private readonly user?: SoundCloudUser) {
  }

  async fetch(): Promise<FetchResult> {
    const user = this.user ? this.user : await soundcloud.getUser(this.id);
    const { max, downloader } = this.getListOptions('Fetching likes', user.public_favorites_count);
    const tracks = await soundcloud.getUserFavorites(this.id, max, downloader);
    return { tracks: tracks.map(mapSoundCloudTrack) };
  }

  private getListOptions(downloaderName: string, max: number): { max: number, downloader?: ProgressUpdater } {
    let downloader: ProgressUpdater | undefined;

    const range = getRangeOption(this.params, max);
    if (range) {
      max = range.stop;
    }

    if (max > 300) {
      downloader = new DownloaderDisplay(this.channel, downloaderName);
    }

    return { max, downloader };
  }

}