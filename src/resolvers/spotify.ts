import { Spotify, SpotifyResourceType } from 'api/spotify';
import { IDENTIFIER_TYPE, SOURCE } from 'common/constants';
import { EolianBotError } from 'common/errors';

export class SpotifyResolver implements SourceResolver {

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
      throw new EolianBotError('Missing query for album.');
    }

    const albums = await Spotify.API.searchAlbums(this.params.QUERY);

    const options = albums.map(album => `${album.name} - ${album.artists.map(artist => artist.name).join(',')}`);
    const idx = await this.context.channel
        .sendSelection(`Select the album you want (resolved via Spotify)`, options, this.context.user.id);
    if (idx === null) {
      throw new EolianBotError('Nothing selected. Cancelled request.');
    }

    const album = albums[idx];
    return createSpotifyAlbum(album);
  }

  private async resolvePlaylist(): Promise<ResolvedResource> {
    const playlists = await this.searchSpotifyPlaylists();
    if (playlists.length === 0) {
      throw new EolianBotError(`No Spotify playlists were found.`);
    }

    let playlist = playlists[0];
    if (playlists.length > 1) {
      const idx = await this.context.channel.sendSelection('Choose a Spotify playlist',
        playlists.map(playlist => playlist.name), this.context.user.id);
      if (idx === null) {
        throw new EolianBotError('Nothing selected. Cancelled request.');
      }
      playlist = playlists[idx];
    }

    return createSpotifyPlaylist(playlist);
  }

  private async searchSpotifyPlaylists(): Promise<SpotifyPlaylist[]> {
    let playlists: SpotifyPlaylist[];

    if (this.params.MY) {
      const user = await this.context.user.get();
      if (!user.spotify) {
        throw new EolianBotError(`User has not set Spotify account`,
          `I can't search your Spotify playlists because you haven't set your Spotify account yet!`);
      }
      playlists = await Spotify.API.searchPlaylists(this.params.QUERY, user.spotify);
    } else if (this.params.QUERY) {
      playlists = await Spotify.API.searchPlaylists(this.params.QUERY);
    } else {
      throw new EolianBotError('You must specify a query or use the MY keyword.')
    }

    return playlists;
  }

  private async resolveArtist(): Promise<ResolvedResource> {
    if (!this.params.QUERY) {
      throw new EolianBotError('Missing query for Spotify artist.');
    }

    const artists = await Spotify.API.searchArtists(this.params.QUERY);
    const idx = await this.context.channel.sendSelection('Choose a Spotify artist',
      artists.map(artist => artist.name), this.context.user.id);
    if (idx === null) {
      throw new EolianBotError('Nothing selected. Cancelled request.');
    }

    return createSpotifyArtist(artists[idx]);
  }

}

async function resolveUrl(url: string): Promise<ResolvedResource> {
  const resourceDetails = Spotify.getResourceType(url);
  switch (resourceDetails && resourceDetails.type) {
    case SpotifyResourceType.PLAYLIST:
      const playlist = await Spotify.API.getPlaylist(resourceDetails.id);
      return createSpotifyPlaylist(playlist);
    case SpotifyResourceType.ALBUM:
      const album = await Spotify.API.getAlbum(resourceDetails.id);
      return createSpotifyAlbum(album);
    case SpotifyResourceType.ARTIST:
      const artist = await Spotify.API.getArtist(resourceDetails.id);
      return createSpotifyArtist(artist);
    default:
      throw new EolianBotError('The Spotify URL is not valid!');
  }
}

function createSpotifyPlaylist(playlist: SpotifyPlaylist): ResolvedResource {
  return {
    name: playlist.name,
    authors: [playlist.owner.display_name],
    identifier: {
      id: playlist.id,
      src: SOURCE.SPOTIFY,
      type: IDENTIFIER_TYPE.PLAYLIST,
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
      type: IDENTIFIER_TYPE.ALBUM,
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
      type: IDENTIFIER_TYPE.ARTIST,
      url: artist.external_urls.spotify
    }
  };
}