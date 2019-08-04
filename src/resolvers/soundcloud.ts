import { SoundCloud, SoundCloudResourceType } from 'api/soundcloud';
import { IDENTIFIER_TYPE } from 'common/constants';
import { EolianBotError } from 'common/errors';

export class SoundCloudResolver implements SourceResolver {

  constructor(private readonly context: CommandActionContext, private readonly params: CommandActionParams) {
  }

  async resolve(): Promise<ResolvedResource> {
    let resource: ResolvedResource;

    if (this.params.URL) {
      resource = await resolveUrl(this.params.URL.value);
    } else {
      resource = await this.resolveTarget();
    }

    return resource;
  }

  private resolveTarget(): Promise<ResolvedResource> {
    if (this.params.PLAYLIST) {
      return this.resolvePlaylist();
    } else if (this.params.TRACKS) {
      return this.resolveTracks();
    } else if (this.params.FAVORITES) {
      return this.resolveFavorites();
    } else if (this.params.ARTIST) {
      return this.resolveArtist();
    }
    return this.resolveSong();
  }

  private async resolvePlaylist(): Promise<ResolvedResource> {
    const playlists = await this.searchSoundCloudPlaylists();
    if (playlists.length === 0) {
      throw new EolianBotError(`No SoundCloud playlists were found.`);
    }

    let playlist = playlists[0];
    if (playlists.length > 1) {
      const idx = await this.context.channel.sendSelection('Choose a SoundCloud playlist',
        playlists.map(playlist => playlist.title), this.context.user.id);
      if (idx === null) {
        throw new EolianBotError('Nothing selected. Cancelled request.');
      }
      playlist = playlists[idx];
    }

    return createSoundCloudPlaylist(playlist);
  }

  private async searchSoundCloudPlaylists(): Promise<SoundCloudPlaylist[]> {
    let playlists: SoundCloudPlaylist[];

    if (this.params.MY) {
      const user = await this.context.user.get();
      if (!user.soundcloud) {
        throw new EolianBotError('User has not set SoundCloud account.',
          `I can't search your SoundCloud playlists because you haven't set your SoundCloud account yet!`);
      }
      playlists = await SoundCloud.searchPlaylists(this.params.QUERY, user.soundcloud);
    } else if (this.params.QUERY) {
      playlists = await SoundCloud.searchPlaylists(this.params.QUERY);
    } else {
      throw new EolianBotError('You must specify a query or use the MY keyword.');
    }

    return playlists;
  }

  private async resolveTracks(): Promise<ResolvedResource> {
    const resource = await this.resolveArtist();
    resource.identifier.type = IDENTIFIER_TYPE.TRACKS;
    resource.identifier.url = `${resource.identifier.url}/tracks`;
    return resource;
  }

  private async resolveFavorites(): Promise<ResolvedResource> {
    const resource = await this.resolveArtist();
    resource.identifier.type = IDENTIFIER_TYPE.FAVORITES;
    resource.identifier.url = `${resource.identifier.url}/likes`;
    return resource;
  }

  private resolveArtist(): Promise<ResolvedResource> {
    if (this.params.QUERY) {
      return this.resolveArtistQuery();
    } else if (this.params.MY) {
      return this.resolveUser();
    }
    throw new EolianBotError('Missing query for SoundCloud artist.');
  }

  private async resolveArtistQuery(): Promise<ResolvedResource> {
    const users = await SoundCloud.searchUser(this.params.QUERY);
    const idx = await this.context.channel.sendSelection('Choose a SoundCloud user',
      users.map(user => user.username), this.context.user.id);
    if (idx === null) {
      throw new EolianBotError('Nothing selected. Cancelled request.');
    }

    return createSoundCloudUser(users[idx]);
  }

  private async resolveUser(): Promise<ResolvedResource> {
    const user = await this.context.user.get();
    if (!user.soundcloud) {
      throw new EolianBotError('You have not set your SoundCloud account yet!');
    }
    const scUser = await SoundCloud.getUser(user.soundcloud);
    return createSoundCloudUser(scUser);
  }

  private async resolveSong(): Promise<ResolvedResource> {
    if (!this.params.QUERY) {
      throw new EolianBotError('Missing query for SoundCloud song.');
    }

    const songs = await SoundCloud.searchSongs(this.params.QUERY);
    const idx = await this.context.channel.sendSelection('Choose a SoundCloud track',
      songs.map(song => `${song.title} --- ${song.user.username}`), this.context.user.id);
    if (idx === null) {
      throw new EolianBotError('Nothing selected. Cancelled request.');
    }

    return createSoundCloudSong(songs[idx]);
  }

}

async function resolveUrl(url: string): Promise<ResolvedResource> {
  const resource = await SoundCloud.resolve(url);
  switch (resource.kind) {
    case SoundCloudResourceType.PLAYLIST:
      return createSoundCloudPlaylist(resource as SoundCloudPlaylist);
    case SoundCloudResourceType.TRACK:
      return createSoundCloudSong(resource as SoundCloudTrack);
    case SoundCloudResourceType.USER:
      return createSoundCloudUser(resource as SoundCloudUser);
    default:
      throw new EolianBotError('The SoundCloud URL is not valid!');
  }
}

function createSoundCloudPlaylist(playlist: SoundCloudPlaylist): ResolvedResource {
  return {
    name: playlist.title,
    authors: [playlist.user.username],
    identifier: SoundCloud.createIdentifier(playlist)
  };
}

function createSoundCloudSong(track: SoundCloudTrack): ResolvedResource {
  return {
    name: track.title,
    authors: [track.user.username],
    identifier: SoundCloud.createIdentifier(track)
  }
}

function createSoundCloudUser(user: SoundCloudUser): ResolvedResource {
  return {
    name: user.username,
    authors: [user.username],
    identifier: SoundCloud.createIdentifier(user)
  }
}