import { soundcloud } from 'api';
import { SoundCloudUser } from 'api/@types';
import { mapSoundCloudTrack } from 'api/soundcloud';
import { CommandContext, CommandOptions } from 'commands/@types';
import { SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { IdentifierType } from 'data/@types';
import { FetchResult, MessageBundledResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';

type UserResult = MessageBundledResult<SoundCloudUser>;

export class SoundCloudArtistResolver implements SourceResolver {

  constructor(protected readonly context: CommandContext, protected readonly params: CommandOptions) {
  }

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
      return { value: users[0] };
    } else {
      const result = await this.context.interaction.sendSelection('Choose a SoundCloud user',
        users.map(user => ({ name: user.username, url: user.permalink_url })),
        this.context.interaction.user);

      return { value: users[result.selected], message: result.message };
    }
  }

  private async resolveUser(): Promise<SoundCloudUser> {
    const user = await this.context.interaction.user.get();
    if (!user.soundcloud) {
      throw new EolianUserError('You have not set your SoundCloud account yet!');
    }
    return await soundcloud.getUser(user.soundcloud);
  }
}

export class SoundCloudTracksResolver extends SoundCloudArtistResolver {
  async resolve(): Promise<ResolvedResource> {
    const result = await this.getSoundCloudUser();
    const resource = createSoundCloudUser(result);
    resource.name = 'Posted Tracks';
    resource.identifier.type = IdentifierType.TRACKS;
    resource.identifier.url = `${resource.identifier.url}/tracks`;
    return resource;
  }
}


export function createSoundCloudUser({ value: user, message}: UserResult): ResolvedResource {
  return {
    name: user.username,
    authors: [user.username],
    identifier: {
      id: user.id.toString(),
      src: SOURCE.SOUNDCLOUD,
      type: IdentifierType.ARTIST,
      url: user.permalink_url
    },
    fetcher: new SoundCloudArtistFetcher(user.id),
    selectionMessage: message
  }
}

export class SoundCloudArtistFetcher implements SourceFetcher {

  constructor(private readonly id: number) {
  }

  async fetch(): Promise<FetchResult> {
    const tracks = await soundcloud.getUserTracks(this.id);
    return { tracks: tracks.map(mapSoundCloudTrack) };
  }

}
