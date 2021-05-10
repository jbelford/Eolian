import { soundcloud } from 'api';
import { SoundCloudPlaylist, SoundCloudResource, SoundCloudResourceType, SoundCloudTrack, SoundCloudUser } from 'api/@types';
import { CommandContext, CommandOptions } from 'commands/@types';
import { SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { Identifier, IdentifierType } from 'data/@types';
import { Track } from 'music/@types';
import { ResolvedResource, SourceFetcher, SourceResolver } from './@types';

export class SoundCloudUrlResolver implements SourceResolver {

  constructor(private readonly url: string) {
  }

  async resolve(): Promise<ResolvedResource> {
    const resource = await soundcloud.resolve(this.url);
    switch (resource.kind) {
      case SoundCloudResourceType.PLAYLIST:
        return createSoundCloudPlaylist(resource as SoundCloudPlaylist);
      case SoundCloudResourceType.TRACK:
        return createSoundCloudSong(resource as SoundCloudTrack);
      case SoundCloudResourceType.USER:
        return createSoundCloudUser(resource as SoundCloudUser);
      default:
        throw new EolianUserError('The SoundCloud URL is not valid!');
    }
  }
}

export class SoundCloudPlaylistResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    const playlists = await this.searchSoundCloudPlaylists();
    if (playlists.length === 0) {
      throw new EolianUserError(`No SoundCloud playlists were found.`);
    }

    let playlist = playlists[0];
    if (playlists.length > 1) {
      const idx = await this.context.channel.sendSelection('Choose a SoundCloud playlist',
        playlists.map(playlist => playlist.title), this.context.user.id);
      if (idx < 0) {
        throw new EolianUserError('Nothing selected. Cancelled request.');
      }
      playlist = playlists[idx];
    }

    return createSoundCloudPlaylist(playlist);
  }

  private async searchSoundCloudPlaylists(): Promise<SoundCloudPlaylist[]> {
    if (!this.params.QUERY) {
      throw new EolianUserError('You must specify a query.');
    }

    let playlists: SoundCloudPlaylist[];

    if (this.params.MY) {
      const user = await this.context.user.get();
      if (!user.soundcloud) {
        throw new EolianUserError(`I can't search your SoundCloud playlists because you haven't set your SoundCloud account yet!`);
      }
      playlists = await soundcloud.searchPlaylists(this.params.QUERY, user.soundcloud);
    } else {
      playlists = await soundcloud.searchPlaylists(this.params.QUERY);
    }

    return playlists;
  }
}

export class SoundCloudArtistResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    if (this.params.QUERY) {
      return this.resolveArtistQuery(this.params.QUERY);
    } else if (this.params.MY) {
      return this.resolveUser();
    }
    throw new EolianUserError('Missing query for SoundCloud artist.');
  }

  private async resolveArtistQuery(query: string): Promise<ResolvedResource> {
    const users = await soundcloud.searchUser(query);
    const idx = await this.context.channel.sendSelection('Choose a SoundCloud user',
      users.map(user => user.username), this.context.user.id);
    if (idx < 0) {
      throw new EolianUserError('Nothing selected. Cancelled request.');
    }

    return createSoundCloudUser(users[idx]);
  }

  private async resolveUser(): Promise<ResolvedResource> {
    const user = await this.context.user.get();
    if (!user.soundcloud) {
      throw new EolianUserError('You have not set your SoundCloud account yet!');
    }
    const scUser = await soundcloud.getUser(user.soundcloud);
    return createSoundCloudUser(scUser);
  }
}

export class SoundCloudTracksResolver extends SoundCloudArtistResolver {
  async resolve(): Promise<ResolvedResource> {
    const resource = await super.resolve();
    resource.identifier.type = IdentifierType.TRACKS;
    resource.identifier.url = `${resource.identifier.url}/tracks`;
    return resource;
  }
}

export class SoundCloudFavoritesResolver extends SoundCloudArtistResolver {
  async resolve(): Promise<ResolvedResource> {
    const resource = await super.resolve();
    resource.identifier.type = IdentifierType.FAVORITES;
    resource.identifier.url = `${resource.identifier.url}/likes`;
    return resource;
  }
}

export class SoundCloudSongResolver implements SourceResolver {
  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.QUERY) {
      throw new EolianUserError('Missing query for SoundCloud song.');
    }

    const songs = await soundcloud.searchSongs(this.params.QUERY);
    const idx = await this.context.channel.sendSelection('Choose a SoundCloud track',
      songs.map(song => `${song.title} --- ${song.user.username}`), this.context.user.id);
    if (idx < 0) {
      throw new EolianUserError('Nothing selected. Cancelled request.');
    }

    return createSoundCloudSong(songs[idx]);
  }
}

function createSoundCloudPlaylist(playlist: SoundCloudPlaylist): ResolvedResource {
  return {
    name: playlist.title,
    authors: [playlist.user.username],
    identifier: createIdentifier(playlist)
  };
}

function createSoundCloudSong(track: SoundCloudTrack): ResolvedResource {
  return {
    name: track.title,
    authors: [track.user.username],
    identifier: createIdentifier(track),
    tracks: [mapSoundCloudTrack(track)]
  }
}

function createSoundCloudUser(user: SoundCloudUser): ResolvedResource {
  return {
    name: user.username,
    authors: [user.username],
    identifier: createIdentifier(user)
  }
}

function createIdentifier(resource: SoundCloudResource): Identifier {
  return {
    id: resource.id.toString(),
    src: SOURCE.SOUNDCLOUD,
    type: soundCloudTypeToIdentifier(resource.kind),
    url: resource.permalink_url
  };
}

function soundCloudTypeToIdentifier(type: SoundCloudResourceType): IdentifierType {
  switch (type) {
    case SoundCloudResourceType.PLAYLIST: return IdentifierType.PLAYLIST;
    case SoundCloudResourceType.TRACK: return IdentifierType.SONG;
    case SoundCloudResourceType.USER: return IdentifierType.ARTIST;
    default: throw new Error('Unrecognized SoundCloud resource type');
  }
}

function mapSoundCloudTrack(track: SoundCloudTrack): Track {
  return {
    id: track.id.toString(),
    poster: track.user.username,
    src: SOURCE.SOUNDCLOUD,
    url: track.permalink_url,
    stream: track.stream_url,
    title: track.title,
    artwork: track.artwork_url && track.artwork_url.replace('large', 't500x500')
  };
}

export class SoundCloudFetcher implements SourceFetcher {

  constructor(private readonly identifier: Identifier) {}

  async fetch(): Promise<Track[]> {
    if (this.identifier.src !== SOURCE.SOUNDCLOUD) {
      throw new Error('Attempted to fetch tracks for incorrect source type');
    }

    switch (this.identifier.type) {
      case IdentifierType.PLAYLIST: return this.fetchPlaylist(this.identifier.id);
      case IdentifierType.SONG: return [await this.fetchTrack(this.identifier.id)];
      case IdentifierType.TRACKS:
      case IdentifierType.ARTIST: return this.fetchUserTracks(this.identifier.id);
      case IdentifierType.FAVORITES:
      default: throw new Error(`Identifier type is unrecognized ${this.identifier.type}`);
    }
  }

  async fetchPlaylist(id: string): Promise<Track[]> {
    const playlist = await soundcloud.getPlaylist(+id);
    return playlist.tracks!.map(mapSoundCloudTrack);
  }

  async fetchTrack(id: string): Promise<Track> {
    return mapSoundCloudTrack(await soundcloud.getTrack(+id));
  }

  async fetchUserTracks(id: string): Promise<Track[]> {
    const tracks = await soundcloud.getUserTracks(+id);
    return tracks.map(mapSoundCloudTrack);
  }

}