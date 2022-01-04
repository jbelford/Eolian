import { soundcloud } from 'api';
import { SoundCloudUser, TrackSource } from 'api/@types';
import { mapSoundCloudTrack } from 'api/soundcloud';
import { CommandOptions } from 'commands/@types';
import { getRangeOption } from 'commands/patterns';
import { ProgressUpdater } from 'common/@types';
import { ResourceType } from 'data/@types';
import { DownloaderDisplay } from 'framework';
import { ContextMessage, ContextSendable } from 'framework/@types';
import { FetchResult, ResolvedResource, SourceFetcher } from 'resolvers/@types';
import { SoundCloudArtistResolver } from './artist';

export class SoundCloudFavoritesResolver extends SoundCloudArtistResolver {
  async resolve(): Promise<ResolvedResource> {
    const result = await this.getSoundCloudUser();
    return createSoundCloudLikes(
      result.value,
      this.params,
      this.context.interaction.channel,
      result.message
    );
  }
}

export function createSoundCloudLikes(
  user: SoundCloudUser,
  params: CommandOptions,
  sendable: ContextSendable,
  message?: ContextMessage
): ResolvedResource {
  return {
    name: 'Liked Tracks',
    authors: [user.username],
    identifier: {
      id: user.id.toString(),
      src: TrackSource.SoundCloud,
      type: ResourceType.Likes,
      url: `${user.permalink_url}/likes`,
    },
    fetcher: new SoundCloudFavoritesFetcher(user.id, params, sendable, user),
    selectionMessage: message,
  };
}

export class SoundCloudFavoritesFetcher implements SourceFetcher {
  constructor(
    private readonly id: number,
    private readonly params: CommandOptions,
    private readonly sendable: ContextSendable,
    private readonly user?: SoundCloudUser
  ) {}

  async fetch(): Promise<FetchResult> {
    const user = this.user ? this.user : await soundcloud.getUser(this.id);
    const { max, downloader } = this.getListOptions('Fetching likes', user.public_favorites_count);
    const tracks = await soundcloud.getUserFavorites(this.id, max, downloader);
    return { tracks: tracks.map(mapSoundCloudTrack) };
  }

  private getListOptions(
    downloaderName: string,
    max: number
  ): { max: number; downloader?: ProgressUpdater } {
    let downloader: ProgressUpdater | undefined;

    const range = getRangeOption(this.params, max);
    if (range) {
      max = range.stop;
    }

    if (max > 300) {
      downloader = new DownloaderDisplay(this.sendable, downloaderName);
    }

    return { max, downloader };
  }
}
