import { mapSoundCloudTrack, soundcloud } from '@eolian/api';
import { TrackSource } from '@eolian/api/@types';
import { ISoundCloudApi, SoundCloudUser } from '@eolian/api/soundcloud/@types';
import { getRangeOption } from '@eolian/command-options';
import { CommandOptions } from '@eolian/command-options/@types';
import { ProgressUpdater } from '@eolian/common/@types';
import { ResourceType } from '@eolian/data/@types';
import { DownloaderDisplay } from '@eolian/framework';
import { ContextSendable, ContextMessage } from '@eolian/framework/@types';
import { ResolvedResource, SourceFetcher, FetchResult } from '../@types';
import { SoundCloudArtistResolver, UserResult } from './soundcloud-artist-resolver';

export class SoundCloudFavoritesResolver extends SoundCloudArtistResolver {
  public source = TrackSource.SoundCloud;

  async resolve(): Promise<ResolvedResource> {
    const result = await this.getSoundCloudUser();
    return createSoundCloudLikes(
      result,
      this.params,
      this.context.interaction.channel,
      result.message,
    );
  }
}

export function createSoundCloudLikes(
  result: UserResult,
  params: CommandOptions,
  sendable: ContextSendable,
  message?: ContextMessage,
): ResolvedResource {
  return {
    name: 'Liked Tracks',
    authors: [result.value.user.username],
    identifier: {
      id: result.value.user.id.toString(),
      src: TrackSource.SoundCloud,
      type: ResourceType.Likes,
      url: `${result.value.user.permalink_url}/likes`,
      auth: !!result.value.client,
    },
    fetcher: new SoundCloudFavoritesFetcher(
      result.value.client ?? result.value.user.id,
      params,
      sendable,
      result.value.user,
    ),
    selectionMessage: message,
  };
}

export class SoundCloudFavoritesFetcher implements SourceFetcher {
  constructor(
    private readonly idOrClient: number | ISoundCloudApi,
    private readonly params: CommandOptions,
    private readonly sendable: ContextSendable,
    private readonly user?: SoundCloudUser,
  ) {}

  async fetch(): Promise<FetchResult> {
    const user =
      this.user ??
      (typeof this.idOrClient === 'number'
        ? await soundcloud.getUser(this.idOrClient)
        : await this.idOrClient.getMe());

    const { max, downloader } = this.getListOptions('Fetching likes', user.public_favorites_count);

    const tracks =
      typeof this.idOrClient === 'number'
        ? await soundcloud.getUserFavorites(this.idOrClient, max, downloader)
        : await this.idOrClient.getMyFavorites(max, downloader);

    return { tracks: tracks.map(mapSoundCloudTrack) };
  }

  private getListOptions(
    downloaderName: string,
    max: number,
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
