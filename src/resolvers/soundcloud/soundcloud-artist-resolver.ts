import { createSoundCloudClient, mapSoundCloudTrack, soundcloud } from '@eolian/api';
import { TrackSource } from '@eolian/api/@types';
import { SoundCloudUser, ISoundCloudApi } from '@eolian/api/soundcloud/@types';
import { CommandOptions } from '@eolian/command-options/@types';
import { CommandContext } from '@eolian/commands/@types';
import { EolianUserError } from '@eolian/common/errors';
import { feature } from '@eolian/data';
import { FeatureFlag, ResourceType } from '@eolian/data/@types';
import {
  MessageBundledResult,
  SourceResolver,
  ResolvedResource,
  SourceFetcher,
  FetchResult,
} from '../@types';

type UserResultValue = { user: SoundCloudUser; client?: ISoundCloudApi };
export type UserResult = MessageBundledResult<UserResultValue>;

export class SoundCloudArtistResolver implements SourceResolver {
  public source = TrackSource.SoundCloud;

  constructor(
    protected readonly context: CommandContext,
    protected readonly params: CommandOptions,
  ) {}

  async resolve(): Promise<ResolvedResource> {
    const result = await this.getSoundCloudUser();
    return createSoundCloudUser(result);
  }

  protected async getSoundCloudUser(): Promise<UserResult> {
    if (this.params.SEARCH) {
      return await this.resolveArtistQuery(this.params.SEARCH);
    } else if (this.params.MY) {
      return { value: await this.resolveUser() };
    }
    throw new EolianUserError('Missing query for SoundCloud artist.');
  }

  private async resolveArtistQuery(query: string): Promise<UserResult> {
    const users = await soundcloud.searchUser(query, this.params.FAST ? 1 : 5);
    if (users.length === 0) {
      throw new EolianUserError('No SoundCloud users were found.');
    } else if (users.length === 1) {
      return { value: { user: users[0] } };
    } else {
      const result = await this.context.interaction.sendSelection(
        'Choose a SoundCloud user',
        users.map(user => ({ name: user.username, url: user.permalink_url })),
        this.context.interaction.user,
      );

      return { value: { user: users[result.selected] }, message: result.message };
    }
  }

  private async resolveUser(): Promise<UserResultValue> {
    if (feature.enabled(FeatureFlag.SOUNDCLOUD_AUTH)) {
      const request = await this.context.interaction.user.getRequest(
        this.context.interaction,
        TrackSource.SoundCloud,
      );
      const client = createSoundCloudClient(request);
      return { user: await client.getMe(), client };
    } else {
      const user = await this.context.interaction.user.get();
      if (!user.soundcloud) {
        throw new EolianUserError('You have not set your SoundCloud account yet!');
      }
      return { user: await soundcloud.getUser(user.soundcloud) };
    }
  }
}

export class SoundCloudTracksResolver extends SoundCloudArtistResolver {
  async resolve(): Promise<ResolvedResource> {
    const result = await this.getSoundCloudUser();
    const resource = createSoundCloudUser(result);
    resource.name = 'Posted Tracks';
    resource.identifier.type = ResourceType.Tracks;
    resource.identifier.url = `${resource.identifier.url}/tracks`;
    return resource;
  }
}

export function createSoundCloudUser({ value, message }: UserResult): ResolvedResource {
  return {
    name: value.user.username,
    authors: [value.user.username],
    identifier: {
      id: value.user.id.toString(),
      src: TrackSource.SoundCloud,
      type: ResourceType.Artist,
      url: value.user.permalink_url,
      auth: !!value.client,
    },
    fetcher: new SoundCloudArtistFetcher(value.client ?? value.user.id),
    selectionMessage: message,
  };
}

export class SoundCloudArtistFetcher implements SourceFetcher {
  constructor(private readonly idOrClient: number | ISoundCloudApi) {}

  async fetch(): Promise<FetchResult> {
    const tracks =
      typeof this.idOrClient === 'number'
        ? await soundcloud.getUserTracks(this.idOrClient)
        : await this.idOrClient.getMyTracks();
    return { tracks: tracks.map(mapSoundCloudTrack) };
  }
}
