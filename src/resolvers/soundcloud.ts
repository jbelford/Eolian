import { soundcloud } from 'api';
import { SoundCloudPlaylist, SoundCloudResource, SoundCloudResourceType, SoundCloudTrack, SoundCloudUser, Track } from 'api/@types';
import { CommandContext, CommandOptions } from 'commands/@types';
import { ProgressUpdater } from 'common/@types';
import { MESSAGES, SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { getRangeOption } from 'common/util';
import { Identifier, IdentifierType } from 'data/@types';
import { DownloaderDisplay } from 'eolian';
import { ContextTextChannel } from 'eolian/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from './@types';

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
        playlists.map(playlist => ({ name: playlist.title, subname: playlist.user.username, url: playlist.permalink_url })),
        this.context.user);
      if (idx < 0) {
        throw new EolianUserError(MESSAGES.NO_SELECTION);
      }
      playlist = playlists[idx];
    }

    return createSoundCloudPlaylist(playlist);
  }

  private async searchSoundCloudPlaylists(): Promise<SoundCloudPlaylist[]> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('You must specify a SEARCH query.');
    }

    let playlists: SoundCloudPlaylist[];

    if (this.params.MY) {
      const user = await this.context.user.get();
      if (!user.soundcloud) {
        throw new EolianUserError(`I can't search your SoundCloud playlists because you haven't set your SoundCloud account yet!`);
      }
      playlists = await soundcloud.searchPlaylists(this.params.SEARCH, user.soundcloud);
    } else {
      playlists = await soundcloud.searchPlaylists(this.params.SEARCH);
    }

    return playlists;
  }
}

export class SoundCloudArtistResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    if (this.params.SEARCH) {
      return this.resolveArtistQuery(this.params.SEARCH);
    } else if (this.params.MY) {
      return this.resolveUser();
    }
    throw new EolianUserError('Missing query for SoundCloud artist.');
  }

  private async resolveArtistQuery(query: string): Promise<ResolvedResource> {
    const users = await soundcloud.searchUser(query);
    const idx = await this.context.channel.sendSelection('Choose a SoundCloud user',
      users.map(user => ({ name: user.username, url: user.permalink_url })),
      this.context.user);
    if (idx < 0) {
      throw new EolianUserError(MESSAGES.NO_SELECTION);
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
    if (!this.params.SEARCH) {
      throw new EolianUserError('Missing SEARCH query for SoundCloud song.');
    }

    const songs = await soundcloud.searchSongs(this.params.SEARCH);
    const idx = await this.context.channel.sendSelection('Choose a SoundCloud track',
      songs.map(song =>  ({ name: song.title, url: song.permalink_url })),
      this.context.user);
    if (idx < 0) {
      throw new EolianUserError(MESSAGES.NO_SELECTION);
    }

    return createSoundCloudSong(songs[idx]);
  }
}

function createSoundCloudPlaylist(playlist: SoundCloudPlaylist): ResolvedResource {
  return {
    name: playlist.title,
    authors: [playlist.user.username],
    identifier: createIdentifier(playlist),
    fetcher: new SoundCloudPlaylistFetcher(playlist.id, playlist)
  };
}

function createSoundCloudSong(track: SoundCloudTrack): ResolvedResource {
  return {
    name: track.title,
    authors: [track.user.username],
    identifier: createIdentifier(track),
    fetcher: new SoundCloudSongFetcher(track.id, track)
  }
}

function createSoundCloudUser(user: SoundCloudUser): ResolvedResource {
  return {
    name: user.username,
    authors: [user.username],
    identifier: createIdentifier(user),
    fetcher: new SoundCloudArtistFetcher(user.id)
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
    stream: track.streamable && track.access === 'playable' ? track.stream_url : undefined,
    title: track.title,
    artwork: track.artwork_url && track.artwork_url.replace('large', 't500x500')
  };
}

export class SoundCloudPlaylistFetcher implements SourceFetcher {

  constructor(private readonly id: number,
    private readonly playlist?: SoundCloudPlaylist) {
  }

  async fetch(): Promise<FetchResult> {
    let tracks: SoundCloudTrack[];
    if (this.playlist && this.playlist.tracks.length === this.playlist.track_count) {
      tracks = this.playlist.tracks;
    } else {
      const playlist = await soundcloud.getPlaylist(this.id);
      tracks = playlist.tracks;
    }
    return { tracks: tracks.map(mapSoundCloudTrack) };
  }

}

export class SoundCloudSongFetcher implements SourceFetcher {

  constructor(private readonly id: number,
    private readonly track?: SoundCloudTrack) {
  }

  async fetch(): Promise<FetchResult> {
    const track = this.track ? this.track : await soundcloud.getTrack(this.id);
    return { tracks: [mapSoundCloudTrack(track)], rangeOptimized: true };
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

export class SoundCloudFavoritesFetcher implements SourceFetcher {

  constructor(private readonly id: number,
    private readonly params: CommandOptions,
    private readonly channel: ContextTextChannel) {
  }

  async fetch(): Promise<FetchResult> {
    const user = await soundcloud.getUser(this.id);
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

export function getSoundCloudSourceFetcher(id: number,
    type: IdentifierType,
    params: CommandOptions,
    channel: ContextTextChannel): SourceFetcher {
  switch (type) {
    case IdentifierType.TRACKS:
    case IdentifierType.ARTIST:
      return new SoundCloudArtistFetcher(id);
    case IdentifierType.FAVORITES:
      return new SoundCloudFavoritesFetcher(id, params, channel);
    case IdentifierType.PLAYLIST:
      return new SoundCloudPlaylistFetcher(id);
    case IdentifierType.SONG:
      return new SoundCloudSongFetcher(id);
    default:
      throw new Error(`Invalid type for SoundCloud fetcher`);
  }
}
