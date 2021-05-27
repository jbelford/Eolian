import { spotify } from 'api';
import { SpotifyAlbum, SpotifyArtist, SpotifyPlaylist, SpotifyRangeFactory, SpotifyResourceType, SpotifyTrack } from 'api/@types';
import { CommandContext, CommandOptions } from 'commands/@types';
import { ProgressUpdater } from 'common/@types';
import { SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { getRangeOption } from 'common/util';
import { Identifier, IdentifierType } from 'data/@types';
import { SelectionOption } from 'embed/@types';
import { ContextTextChannel } from 'eolian/@types';
import { DownloaderDisplay } from 'eolian/downloader';
import { Track } from 'music/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from './@types';

export class SpotifyUrlResolver implements SourceResolver {

  constructor(private readonly url: string) {
  }

  async resolve(): Promise<ResolvedResource> {
    const resourceDetails = spotify.resolve(this.url);
    if (resourceDetails) {
      switch (resourceDetails.type) {
        case SpotifyResourceType.PLAYLIST: {
          const playlist = await spotify.getPlaylist(resourceDetails.id);
          return createSpotifyPlaylist(playlist);
        }
        case SpotifyResourceType.ALBUM: {
          const album = await spotify.getAlbum(resourceDetails.id);
          return createSpotifyAlbum(album);
        }
        case SpotifyResourceType.ARTIST: {
          const artist = await spotify.getArtist(resourceDetails.id);
          return createSpotifyArtist(artist);
        }
        default:
      }
    }
    throw new EolianUserError('The Spotify URL is not valid!');
  }

}

export class SpotifyAlbumResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.QUERY) {
      throw new EolianUserError('Missing query for album.');
    }

    const albums = await spotify.searchAlbums(this.params.QUERY);

    const options: SelectionOption[] = albums.map(album => ({
      name: album.name,
      subname: album.artists.map(artist => artist.name).join(','),
      url: album.external_urls.spotify
    }));
    const idx = await this.context.channel.sendSelection(
      `Select the album you want (resolved via Spotify)`, options, this.context.user);
    if (idx < 0) {
      throw new EolianUserError('Nothing selected. Cancelled request.');
    }

    const album = albums[idx];
    return createSpotifyAlbum(album);
  }
}

export class SpotifyPlaylistResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    const playlists = await this.searchSpotifyPlaylists();
    if (playlists.length === 0) {
      throw new EolianUserError(`No Spotify playlists were found.`);
    }

    let playlist = playlists[0];
    if (playlists.length > 1) {
      const idx = await this.context.channel.sendSelection('Choose a Spotify playlist',
        playlists.map(playlist => ({ name: playlist.name, subname: playlist.owner.display_name, url: playlist.external_urls.spotify })),
        this.context.user);
      if (idx < 0) {
        throw new EolianUserError('Nothing selected. Cancelled request.');
      }
      playlist = playlists[idx];
    }

    return createSpotifyPlaylist(playlist);
  }

  private async searchSpotifyPlaylists(): Promise<SpotifyPlaylist[]> {
    if (!this.params.QUERY) {
      throw new EolianUserError('You must specify a query.');
    }

    let playlists: SpotifyPlaylist[];

    if (this.params.MY) {
      const user = await this.context.user.get();
      if (!user.spotify) {
        throw new EolianUserError(`I can't search your Spotify playlists because you haven't set your Spotify account yet!`);
      }
      playlists = await spotify.searchPlaylists(this.params.QUERY, user.spotify);
    } else {
      playlists = await spotify.searchPlaylists(this.params.QUERY);
    }

    return playlists;
  }

}

export class SpotifyArtistResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.QUERY) {
      throw new EolianUserError('Missing query for Spotify artist.');
    }

    const artists = await spotify.searchArtists(this.params.QUERY);
    const idx = await this.context.channel.sendSelection('Choose a Spotify artist',
      artists.map(artist => ({ name: artist.name, url: artist.external_urls.spotify })),
      this.context.user);
    if (idx < 0) {
      throw new EolianUserError('Nothing selected. Cancelled request.');
    }

    return createSpotifyArtist(artists[idx]);
  }
}


function createSpotifyPlaylist(playlist: SpotifyPlaylist): ResolvedResource {
  return {
    name: playlist.name,
    authors: [playlist.owner.display_name || '<unknown>'],
    identifier: {
      id: playlist.id,
      src: SOURCE.SPOTIFY,
      type: IdentifierType.PLAYLIST,
      url: playlist.external_urls.spotify
    }
  };
}

function createSpotifyAlbum(album: SpotifyAlbum): ResolvedResource {
  return {
    name: album.name,
    authors: album.artists.map(x => x.name),
    identifier: {
      id: album.id,
      src: SOURCE.SPOTIFY,
      type: IdentifierType.ALBUM,
      url: album.external_urls.spotify
    }
  };
}

function createSpotifyArtist(artist: SpotifyArtist): ResolvedResource {
  return {
    name: artist.name,
    authors: [artist.name],
    identifier: {
      id: artist.id,
      src: SOURCE.SPOTIFY,
      type: IdentifierType.ARTIST,
      url: artist.external_urls.spotify
    }
  };
}

function mapSpotifyTrack(track: SpotifyTrack, artwork?: string): Track {
  if (!artwork && track.album.images.length) {
    artwork = track.album.images[0].url;
  }
  return {
    id: track.id,
    poster: track.artists.map(artist => artist.name).join(', '),
    title: track.name,
    src: SOURCE.SPOTIFY,
    url: track.external_urls.spotify,
    artwork
  };
}

export class SpotifyFetcher implements SourceFetcher {

  constructor(private readonly identifier: Identifier,
    private readonly params: CommandOptions,
    private readonly channel?: ContextTextChannel) {}

  async fetch(): Promise<FetchResult> {
    if (this.identifier.src !== SOURCE.SPOTIFY) {
      throw new Error('Attempted to fetch tracks for incorrect source type');
    }

    switch (this.identifier.type) {
      case IdentifierType.PLAYLIST: return { tracks: await this.fetchPlaylist(this.identifier.id), rangeOptimized: true };
      case IdentifierType.ALBUM: return { tracks: await this.fetchAlbum(this.identifier.id) };
      case IdentifierType.ARTIST: return { tracks: await this.fetchArtistTracks(this.identifier.id) };
      default: throw new Error(`Identifier type is unrecognized ${this.identifier.type}`);
    }
  }

  async fetchPlaylist(id: string): Promise<Track[]> {
    let progress: ProgressUpdater | undefined;

    const rangeFn: SpotifyRangeFactory = total => getRangeOption(this.params, total);

    if (this.channel) {
      progress = new DownloaderDisplay(this.channel, 'Fetching playlist tracks');
    }

    const playlist = await spotify.getPlaylistTracks(id, progress, rangeFn);
    return playlist.tracks.items.map(playlistTrack => mapSpotifyTrack(playlistTrack.track));
  }

  async fetchAlbum(id: string): Promise<Track[]> {
    const album = await spotify.getAlbumTracks(id);
    const artwork = album.images.length ? album.images[0].url : undefined;
    return album.tracks.items.map(track => mapSpotifyTrack(track, artwork));
  }

  async fetchArtistTracks(id: string): Promise<Track[]> {
    const tracks = await spotify.getArtistTracks(id);
    return tracks.map(track => mapSpotifyTrack(track));
  }

}