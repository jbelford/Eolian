import environment from 'common/env';
import { EolianBotError } from 'common/errors';
import { logger } from 'common/logger';
import * as fuzz from 'fuzzball';
import * as SpotifyWebApi from 'spotify-web-api-node';

export const enum SpotifyResourceType {
  USER = 'user',
  TRACK = 'track',
  PLAYLIST = 'playlist',
  ARTIST = 'artist',
  ALBUM = 'album'
}

export namespace Spotify {

  const spotify = new SpotifyWebApi({
    clientId: environment.tokens.spotify.clientId,
    clientSecret: environment.tokens.spotify.clientSecret
  });
  let expiration = 0;

  export function getResourceType(uri: string): SpotifyUrlDetails | undefined {
    const matcher = /(spotify\.com\/|spotify:)(user|track|album|playlist|artist)[:\/]([^\?]+)/g
    const regArr = matcher.exec(uri);
    if (!regArr) return null;
    return { type: regArr[2] as SpotifyResourceType, id: regArr[3] };
  }

  export async function getUser(id: string): Promise<SpotifyUser> {
    try {
      logger.debug(`Getting user: ${id}`);
      await checkAndUpdateToken();
      const response = await spotify.getUser(id);
      const user = <SpotifyUser>response.body;
      return user;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify user.');
    }
  }

  export async function getPlaylist(id: string): Promise<SpotifyPlaylist> {
    try {
      logger.debug(`Getting playlist: ${id}`);
      await checkAndUpdateToken();
      const response = await spotify.getPlaylist(id, { fields: 'id,name,owner,external_urls' });
      const playlist = <SpotifyPlaylist>response.body;
      return playlist;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify playlist.');
    }
  }

  export async function getAlbum(id: string): Promise<SpotifyAlbumFull> {
    try {
      logger.debug(`Getting album: ${id}`);
      await checkAndUpdateToken();
      const response = await spotify.getAlbum(id);
      const album = <SpotifyAlbumFull>response.body;
      return album;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify album.');
    }
  }

  export async function getAlbumTracks(id: string): Promise<SpotifyAlbumFull> {
    try {
      const album = await getAlbum(id);
      album.tracks.items = await getAllItems(options => spotify.getAlbumTracks(id, options), album.tracks);
      return album;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify album tracks.');
    }
  }

  async function getAllItems<T>(
      next: (options: any) => Promise<SpotifyResponse<SpotifyPagingObject<T>>>,
      initial?: SpotifyPagingObject<T>): Promise<T[]> {
    let limit = 50;
    let data = initial ? initial : (await next({ limit, offset: 0 })).body;
    let total = data.total;
    let items = data.items;
    while (items.length < total) {
      const data = await next({ limit, offset: items.length });
      items = items.concat(data.body.items);
    }
    return items;
  }

  export async function getArtist(id: string): Promise<SpotifyArtist> {
    try {
      logger.debug(`Getting artist: ${id}`);
      await checkAndUpdateToken();
      const response = await spotify.getArtist(id);
      const artist = <SpotifyArtist>response.body;
      return artist;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify artist.');
    }
  }

  export async function searchPlaylists(query: string, userId?: string): Promise<SpotifyPlaylist[]> {
    if (userId) return searchUserPlaylists(query, userId);
    try {
      await checkAndUpdateToken();
      const response = await spotify.searchPlaylists(query, { limit: 5 });
      const body = <SpotifySearchResult>response.body;
      return body.playlists.items;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to search Spotify playlists.');
    }
  }

  async function searchUserPlaylists(query: string, userId: string): Promise<SpotifyPlaylist[]> {
    try {
      await checkAndUpdateToken();
      const playlists = await getAllItems<SpotifyPlaylist>(options => spotify.getUserPlaylists(userId, options));
      const results = await fuzz.extractAsPromised(query, playlists.map(playlist => playlist.name),
        { scorer: fuzz.token_sort_ratio, returnObjects: true });
      return results.slice(0, 5).map(result => playlists[result.key]);
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify user playlists.');
    }
  }

  export async function searchAlbums(query: string): Promise<SpotifyAlbum[]> {
    try {
      await checkAndUpdateToken();
      const response = await spotify.searchAlbums(query, { limit: 5 });
      const body = <SpotifySearchResult>response.body;
      return body.albums.items;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify album.');
    }
  }

  export async function searchArtists(query: string, limit = 5): Promise<SpotifyArtist[]> {
    try {
      await checkAndUpdateToken();
      const response = await spotify.searchArtists(query, { limit });
      const body = <SpotifySearchResult>response.body;
      return body.artists.items;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify album.');
    }
  }

  async function checkAndUpdateToken() {
    if (Date.now() + 1000 >= expiration) {
      const data = await spotify.clientCredentialsGrant();
      expiration = Date.now() + data.body.expires_in;
      spotify.setAccessToken(data.body.access_token);
    }
  }


}