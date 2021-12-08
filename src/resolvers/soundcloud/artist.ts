import { soundcloud } from 'api';
import { SoundCloudUser } from 'api/@types';
import { mapSoundCloudTrack } from 'api/soundcloud';
import { CommandContext, CommandOptions } from 'commands/@types';
import { MESSAGES, SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { IdentifierType } from 'data/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from 'resolvers/@types';

export class SoundCloudArtistResolver implements SourceResolver {

  constructor(protected readonly context: CommandContext, protected readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    const user = await this.getSoundCloudUser();
    return createSoundCloudUser(user);
  }

  protected async getSoundCloudUser(): Promise<SoundCloudUser> {
    let user: SoundCloudUser | undefined;
    if (this.params.SEARCH) {
      user = await this.resolveArtistQuery(this.params.SEARCH);
    } else if (this.params.MY) {
      user = await this.resolveUser();
    }

    if (!user) {
      throw new EolianUserError('Missing query for SoundCloud artist.');
    }

    return user;
  }

  private async resolveArtistQuery(query: string): Promise<SoundCloudUser> {
    const users = await soundcloud.searchUser(query);
    const idx = await this.context.interaction.sendSelection('Choose a SoundCloud user',
      users.map(user => ({ name: user.username, url: user.permalink_url })),
      this.context.interaction.user);
    if (idx < 0) {
      throw new EolianUserError(MESSAGES.NO_SELECTION);
    }

    return users[idx];
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
    const user = await this.getSoundCloudUser();
    const resource = createSoundCloudUser(user);
    resource.name = 'Posted Tracks';
    resource.identifier.type = IdentifierType.TRACKS;
    resource.identifier.url = `${resource.identifier.url}/tracks`;
    return resource;
  }
}


export function createSoundCloudUser(user: SoundCloudUser): ResolvedResource {
  return {
    name: user.username,
    authors: [user.username],
    identifier: {
      id: user.id.toString(),
      src: SOURCE.SOUNDCLOUD,
      type: IdentifierType.ARTIST,
      url: user.permalink_url
    },
    fetcher: new SoundCloudArtistFetcher(user.id)
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
