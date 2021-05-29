import { spotify } from 'api';
import { RangeFactory, SpotifyAlbum, SpotifyArtist, SpotifyPlaylist, SpotifyPlaylistTracks, SpotifyResourceType, SpotifyTrack, Track } from 'api/@types';
import { CommandContext, CommandOptions } from 'commands/@types';
import { MESSAGES, SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { getRangeOption } from 'common/util';
import { IdentifierType } from 'data/@types';
import { SelectionOption } from 'embed/@types';
import { DownloaderDisplay } from 'eolian';
import { ContextTextChannel } from 'eolian/@types';
import { FetchResult, ResolvedResource, SourceFetcher, SourceResolver } from './@types';

export class SpotifyUrlResolver implements SourceResolver {

  constructor(private readonly url: string,
    private readonly params: CommandOptions,
    private readonly channel: ContextTextChannel) {
  }

  async resolve(): Promise<ResolvedResource> {
    const resourceDetails = spotify.resolve(this.url);
    if (resourceDetails) {
      switch (resourceDetails.type) {
        case SpotifyResourceType.PLAYLIST: {
          const playlist = await spotify.getPlaylist(resourceDetails.id);
          return createSpotifyPlaylist(playlist, this.params, this.channel);
        }
        case SpotifyResourceType.ALBUM: {
          const album = await spotify.getAlbum(resourceDetails.id);
          return createSpotifyAlbum(album);
        }
        case SpotifyResourceType.ARTIST: {
          const artist = await spotify.getArtist(resourceDetails.id);
          return createSpotifyArtist(artist);
        }
        case SpotifyResourceType.TRACK: {
          const track = await spotify.getTrack(resourceDetails.id);
          return createSpotifyTrack(track);
        }
        case SpotifyResourceType.USER: {
          throw new EolianUserError(`Spotify user URLs are not valid for this operation`);
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
    if (!this.params.SEARCH) {
      throw new EolianUserError('Missing search query for album.');
    }

    const albums = await spotify.searchAlbums(this.params.SEARCH);

    const options: SelectionOption[] = albums.map(album => ({
      name: album.name,
      subname: album.artists.map(artist => artist.name).join(','),
      url: album.external_urls.spotify
    }));
    const idx = await this.context.channel.sendSelection(
      `Select the album you want (resolved via Spotify)`, options, this.context.user);
    if (idx < 0) {
      throw new EolianUserError(MESSAGES.NO_SELECTION);
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
        throw new EolianUserError(MESSAGES.NO_SELECTION);
      }
      playlist = playlists[idx];
    }

    return createSpotifyPlaylist(playlist, this.params, this.context.channel);
  }

  private async searchSpotifyPlaylists(): Promise<SpotifyPlaylist[]> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('You must specify a search query.');
    }

    let playlists: SpotifyPlaylist[];

    if (this.params.MY) {
      const user = await this.context.user.get();
      if (!user.spotify) {
        throw new EolianUserError(`I can't search your Spotify playlists because you haven't set your Spotify account yet!`);
      }
      playlists = await spotify.searchPlaylists(this.params.SEARCH, user.spotify);
    } else {
      playlists = await spotify.searchPlaylists(this.params.SEARCH);
    }

    return playlists;
  }

}

export class SpotifyArtistResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
  }

  async resolve(): Promise<ResolvedResource> {
    if (!this.params.SEARCH) {
      throw new EolianUserError('Missing search query for Spotify artist.');
    }

    const artists = await spotify.searchArtists(this.params.SEARCH);
    const idx = await this.context.channel.sendSelection('Choose a Spotify artist',
      artists.map(artist => ({ name: artist.name, url: artist.external_urls.spotify })),
      this.context.user);
    if (idx < 0) {
      throw new EolianUserError(MESSAGES.NO_SELECTION);
    }

    return createSpotifyArtist(artists[idx]);
  }
}


function createSpotifyPlaylist(playlist: SpotifyPlaylist, params: CommandOptions, channel: ContextTextChannel): ResolvedResource {
  return {
    name: playlist.name,
    authors: [playlist.owner.display_name || '<unknown>'],
    identifier: {
      id: playlist.id,
      src: SOURCE.SPOTIFY,
      type: IdentifierType.PLAYLIST,
      url: playlist.external_urls.spotify
    },
    fetcher: new SpotifyPlaylistFetcher(playlist.id, params, channel, playlist)
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
    },
    fetcher: new SpotifyAlbumFetcher(album.id)
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
    },
    fetcher: new SpotifyArtistFetcher(artist.id)
  };
}

function createSpotifyTrack(track: SpotifyTrack): ResolvedResource {
  return {
    name: track.name,
    authors: track.artists.map(artist => artist.name),
    identifier: {
      id: track.id,
      src: SOURCE.SPOTIFY,
      type: IdentifierType.SONG,
      url: track.external_urls.spotify
    },
    fetcher: new SpotifySongFetcher(track.id, track)
  };
}

function mapSpotifyTrack(track: SpotifyTrack, albumArtwork?: string, playlistArtwork?: string): Track {
  let artwork: string | undefined;
  if (track.is_local && playlistArtwork) {
    artwork = playlistArtwork;
  } else if (!albumArtwork && track.album.images.length) {
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

export class SpotifyPlaylistFetcher implements SourceFetcher {

  constructor(private readonly id: string,
    private readonly params: CommandOptions,
    private readonly channel: ContextTextChannel,
    // @ts-ignore
    private readonly playlist?: SpotifyPlaylist) {
  }

  async fetch(): Promise<FetchResult> {
    let playlist: SpotifyPlaylistTracks;
    let rangeOptimized = false;

    if (this.playlist?.tracks.items && this.playlist.tracks.total === this.playlist.tracks.items.length) {
      playlist = this.playlist as SpotifyPlaylistTracks;
    } else {
      const rangeFn: RangeFactory = total => getRangeOption(this.params, total);
      const progress = new DownloaderDisplay(this.channel, 'Fetching playlist tracks');

      playlist = await spotify.getPlaylistTracks(this.id, progress, rangeFn);

      rangeOptimized = true;
    }

    const defaultForLocals = playlist.images.length ? playlist.images[0].url : undefined;
    const tracks = playlist.tracks.items.filter(item => !!item.track).map(item => mapSpotifyTrack(item.track!, undefined, defaultForLocals));
    return { tracks, rangeOptimized };
  }

}

export class SpotifyAlbumFetcher implements SourceFetcher {

  constructor(private readonly id: string) {
  }

  async fetch(): Promise<FetchResult> {
    const album = await spotify.getAlbumTracks(this.id);
    const artwork = album.images.length ? album.images[0].url : undefined;
    const tracks = album.tracks.items.map(track => mapSpotifyTrack(track, artwork));
    return { tracks };
  }

}

export class SpotifyArtistFetcher implements SourceFetcher {

  constructor(private readonly id: string) {
  }

  async fetch(): Promise<FetchResult> {
    const tracks = await spotify.getArtistTracks(this.id);
    return { tracks: tracks.map(track => mapSpotifyTrack(track)) };
  }

}

export class SpotifySongFetcher implements SourceFetcher {

  constructor(private readonly id: string,
    private readonly track?: SpotifyTrack) {
  }

  async fetch(): Promise<FetchResult> {
    const track = this.track ? this.track : await spotify.getTrack(this.id);
    return { tracks: [mapSpotifyTrack(track)] };
  }

}

export function getSpotifySourceFetcher(id: string,
  type: IdentifierType,
  params: CommandOptions,
  channel: ContextTextChannel): SourceFetcher {

  switch (type) {
    case IdentifierType.ALBUM:
      return new SpotifyAlbumFetcher(id);
    case IdentifierType.ARTIST:
      return new SpotifyArtistFetcher(id);
    case IdentifierType.PLAYLIST:
      return new SpotifyPlaylistFetcher(id, params, channel);
    case IdentifierType.SONG:
      return new SpotifySongFetcher(id);
    default:
      throw new Error('Invalid type for Spotify fetcher');
  }
}