import { spotify } from 'api';
import { SpotifyAlbum, SpotifyArtist, SpotifyPlaylist, SpotifyResourceType } from 'api/spotify';
import { CommandContext, CommandOptions } from 'commands/@types';
import { SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { IdentifierType } from 'data/@types';
import { ResolvedResource, SourceResolver } from './@types';

export class SpotifyResolver implements SourceResolver {

  constructor(private readonly context: CommandContext, private readonly params: CommandOptions) {
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
    if (this.params.ALBUM) {
      return this.resolveAlbum();
    } else if (this.params.PLAYLIST) {
      return this.resolvePlaylist();
    } else if (this.params.ARTIST) {
      return this.resolveArtist();
    }
    throw new Error('Attempted to resolve a Spotify resource without specifying the type.');
  }

  private async resolveAlbum(): Promise<ResolvedResource> {
    if (!this.params.QUERY) {
      throw new EolianUserError('Missing query for album.');
    }

    const albums = await spotify.searchAlbums(this.params.QUERY);

    const options = albums.map(album => `${album.name} - ${album.artists.map(artist => artist.name).join(',')}`);
    const idx = await this.context.channel
        .sendSelection(`Select the album you want (resolved via Spotify)`, options, this.context.user.id);
    if (idx === undefined) {
      throw new EolianUserError('Nothing selected. Cancelled request.');
    }

    const album = albums[idx];
    return createSpotifyAlbum(album);
  }

  private async resolvePlaylist(): Promise<ResolvedResource> {
    const playlists = await this.searchSpotifyPlaylists();
    if (playlists.length === 0) {
      throw new EolianUserError(`No Spotify playlists were found.`);
    }

    let playlist = playlists[0];
    if (playlists.length > 1) {
      const idx = await this.context.channel.sendSelection('Choose a Spotify playlist',
        playlists.map(playlist => playlist.name), this.context.user.id);
      if (idx === undefined) {
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

  private async resolveArtist(): Promise<ResolvedResource> {
    if (!this.params.QUERY) {
      throw new EolianUserError('Missing query for Spotify artist.');
    }

    const artists = await spotify.searchArtists(this.params.QUERY);
    const idx = await this.context.channel.sendSelection('Choose a Spotify artist',
      artists.map(artist => artist.name), this.context.user.id);
    if (idx === undefined) {
      throw new EolianUserError('Nothing selected. Cancelled request.');
    }

    return createSpotifyArtist(artists[idx]);
  }

}

async function resolveUrl(url: string): Promise<ResolvedResource> {
  const resourceDetails = spotify.resolve(url);
  if (resourceDetails) {
    switch (resourceDetails.type) {
      case SpotifyResourceType.PLAYLIST:
        const playlist = await spotify.getPlaylist(resourceDetails.id);
        return createSpotifyPlaylist(playlist);
      case SpotifyResourceType.ALBUM:
        const album = await spotify.getAlbum(resourceDetails.id);
        return createSpotifyAlbum(album);
      case SpotifyResourceType.ARTIST:
        const artist = await spotify.getArtist(resourceDetails.id);
        return createSpotifyArtist(artist);
      default:
    }
  }
  throw new EolianUserError('The Spotify URL is not valid!');
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