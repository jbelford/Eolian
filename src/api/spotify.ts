import { logger } from 'common/logger';
import { EolianCache } from 'data/@types';
import { InMemoryCache } from 'data/cache';
import * as fuzz from 'fuzzball';
import requestPromise from 'request-promise-native';
import { SpotifyAlbum, SpotifyAlbumFull, SpotifyApi, SpotifyArtist, SpotifyPagingObject, SpotifyPlaylist, SpotifyPlaylistFull, SpotifyResourceType, SpotifyTrack, SpotifyUrlDetails, SpotifyUser } from './@types';

interface PaginationOptions {
  limit?: number;
  offset?: number;
}

const enum SPOTIFY_API_VERSIONS {
  V1 = 'v1'
}

const SPOTIFY_API = 'https://api.spotify.com';

export class SpotifyApiImpl implements SpotifyApi {

  private expiration = 0;
  private accessToken?: string;

  constructor(private readonly clientId: string, private readonly clientSecret: string) {
  }

  resolve(uri: string): SpotifyUrlDetails | undefined {
    const matcher = /(spotify\.com\/|spotify:)(user|track|album|playlist|artist)[:\/]([^\?]+)/g
    const regArr = matcher.exec(uri);
    if (!regArr) return;
    return { type: regArr[2] as SpotifyResourceType, id: regArr[3] };
  }

  async getUser(id: string): Promise<SpotifyUser> {
    try {
      logger.debug(`Getting user: ${id}`);
      await this.checkAndUpdateToken();
      return await this.get<SpotifyUser>(`users/${id}`);
    } catch (e) {
      logger.warn(`Failed to fetch Spotify user: id: ${id}`);
      throw e;
    }
  }

  async getPlaylist(id: string): Promise<SpotifyPlaylistFull> {
    try {
      logger.debug(`Getting playlist: ${id}`);
      await this.checkAndUpdateToken();
      return await this.get<SpotifyPlaylistFull>(`playlists/${id}`);
    } catch (e) {
      logger.warn(`Failed to fetch Spotify playlist: id: ${id}`);
      throw e;
    }
  }

  async getPlaylistTracks(id: string): Promise<SpotifyPlaylistFull> {
    try {
      logger.debug(`Getting playlist tracks: ${id}`);
      const playlist = await this.getPlaylist(id);
      playlist.tracks.items = await this.getAllItems(options => this.get(`playlists/${id}/tracks`, options), playlist.tracks);
      return playlist;
    } catch (e) {
      logger.warn(`Failed to fetch Spotify playlist tracks: id: ${id}`);
      throw e;
    }
  }

  async getAlbum(id: string): Promise<SpotifyAlbumFull> {
    try {
      logger.debug(`Getting album: ${id}`);
      await this.checkAndUpdateToken();
      return await this.get<SpotifyAlbumFull>(`albums/${id}`);
    } catch (e) {
      logger.warn(`Failed to fetch Spotify album: id: ${id}`);
      throw e;
    }
  }

  async getAlbumTracks(id: string): Promise<SpotifyAlbumFull> {
    try {
      const album = await this.getAlbum(id);
      album.tracks.items = await this.getAllItems(options => this.get(`albums/${id}/tracks`, options), album.tracks);
      return album;
    } catch (e) {
      logger.warn(`Failed to fetch Spotify album tracks: id: ${id}`);
      throw e;
    }
  }

  async getArtist(id: string): Promise<SpotifyArtist> {
    try {
      logger.debug(`Getting artist: ${id}`);
      await this.checkAndUpdateToken();
      return await this.get<SpotifyArtist>(`artists/${id}`);
    } catch (e) {
      logger.warn(`Failed to fetch Spotify artist: id: ${id}`);
      throw e;
    }
  }

  async getArtistTracks(id: string): Promise<SpotifyTrack[]> {
    try {
      logger.debug(`Getting artist: ${id}`);
      await this.checkAndUpdateToken();
      const response = await this.get<{ tracks: SpotifyTrack[] }>(`artists/${id}/top-tracks`, { country: 'US' });
      return response.tracks;
    } catch (e) {
      logger.warn(`Failed to fetch Spotify artist tracks: id: ${id}`);
      throw e;
    }
  }

  async searchPlaylists(query: string, userId?: string): Promise<SpotifyPlaylist[]> {
    if (userId) {
      return this.searchUserPlaylists(query, userId);
    }

    try {
      await this.checkAndUpdateToken();
      const response = await this.get<{ playlists: SpotifyPagingObject<SpotifyPlaylist>}>('search',
        { type: 'playlist', q: query, limit: 5 });
      return response.playlists.items;
    } catch (e) {
      logger.warn(`Failed to search Spotify playlists: query: ${query} userId: ${userId}`);
      throw e;
    }
  }

  async searchAlbums(query: string): Promise<SpotifyAlbum[]> {
    try {
      await this.checkAndUpdateToken();
      const response = await this.get<{ albums: SpotifyPagingObject<SpotifyAlbum>}>('search',
        { type: 'album', q: query, limit: 5 });
      return response.albums.items;
    } catch (e) {
      logger.warn(`Failed to fetch Spotify album: query: ${query}`);
      throw e;
    }
  }

  async searchArtists(query: string, limit = 5): Promise<SpotifyArtist[]> {
    try {
      await this.checkAndUpdateToken();
      const response = await this.get<{ artists: SpotifyPagingObject<SpotifyArtist>}>('search',
        { type: 'artist', q: query, limit });
      return response.artists.items;
    } catch (e) {
      logger.warn(`Failed to fetch Spotify artists: query: ${query} limit: ${limit}`);
      throw e;
    }
  }

  private async searchUserPlaylists(query: string, userId: string): Promise<SpotifyPlaylist[]> {
    try {
      await this.checkAndUpdateToken();
      const playlists = await this.getAllItems<SpotifyPlaylist>(options => this.get(`users/${userId}/playlists`, options));
      const results = await fuzz.extractAsPromised(query, playlists.map(playlist => playlist.name),
          { scorer: fuzz.token_sort_ratio, returnObjects: true });
      return results.slice(0, 5).map(result => playlists[result.key]);
    } catch (e) {
      logger.warn(`Failed to fetch Spotify user playlists: query: ${query} userId: ${userId}`);
      throw e;
    }
  }

  private async checkAndUpdateToken() {
    if (Date.now() + 1000 >= this.expiration) {
      const data = await this.getToken();
      this.accessToken = data.access_token;
      this.expiration = Date.now() + data.expires_in;
    }
  }

  private async getToken(): Promise<{ access_token: string, expires_in: number }> {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const resp = await requestPromise('https://accounts.spotify.com/api/token',
      { method: 'post', body: 'grant_type=client_credentials', json: true, headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }});

    return resp;
  }

  private get<T>(path: string, params = {}, version = SPOTIFY_API_VERSIONS.V1) : Promise<T> {
    return this.getUrl(`${SPOTIFY_API}/${version}/${path}`, params);
  }

  private getUrl<T>(url: string, params = {}) : Promise<T> {
    return requestPromise(url, { qs: params, json: true, auth: { bearer: this.accessToken } }) as unknown as Promise<T>;
  }

  private async getAllItems<T>(
      next: (options: PaginationOptions) => Promise<SpotifyPagingObject<T>>,
      initial?: SpotifyPagingObject<T>): Promise<T[]> {
    const limit = 50;
    let data = initial ? initial : await next({ limit, offset: 0 });
    const total = data.total;
    let items = data.items;
    while (items.length < total) {
      data = await next({ limit, offset: items.length });
      items = items.concat(data.items);
    }
    return items;
  }

}

export class CachedSpotifyApi implements SpotifyApi {

  private readonly api: SpotifyApi;
  private readonly cache: EolianCache;

  constructor(clientId: string, clientSecret: string, ttl: number) {
    this.api = new SpotifyApiImpl(clientId, clientSecret);
    this.cache = new InMemoryCache(ttl);
  }

  resolve(uri: string): SpotifyUrlDetails | undefined {
    return this.api.resolve(uri);
  }

  async getUser(id: string): Promise<SpotifyUser> {
    return (await this.cache.getOrSet(`user:${id}`, () => this.api.getUser(id)))[0];
  }

  async getPlaylist(id: string): Promise<SpotifyPlaylist> {
    return (await this.cache.getOrSet(`playlist:${id}`, () => this.api.getPlaylist(id)))[0];
  }

  async getPlaylistTracks(id: string): Promise<SpotifyPlaylistFull> {
    return (await this.cache.getOrSet(`playlist:${id}`, () => this.api.getPlaylistTracks(id)))[0];
  }

  async getAlbum(id: string): Promise<SpotifyAlbumFull> {
    return (await this.cache.getOrSet(`album:${id}`, () => this.api.getAlbum(id)))[0];
  }

  async getAlbumTracks(id: string): Promise<SpotifyAlbumFull> {
    return (await this.cache.getOrSet(`albumTracks:${id}`, () => this.api.getAlbumTracks(id)))[0];
  }

  async getArtist(id: string): Promise<SpotifyArtist> {
    return (await this.cache.getOrSet(`artist:${id}`, () => this.api.getArtist(id)))[0];
  }

  async getArtistTracks(id: string): Promise<SpotifyTrack[]> {
    return (await this.cache.getOrSet(`artist:${id}:tracks`, () => this.api.getArtistTracks(id)))[0];
  }

  async searchPlaylists(query: string, userId?: string): Promise<SpotifyPlaylist[]> {
    let key = `searchPlaylists:${query}`;
    if (userId) key = `${key}:${userId}`;
    const [playlists, found] = await this.cache.getOrSet(key, () => this.api.searchPlaylists(query));
    if (!found) {
      await Promise.all(playlists.map(playlist => this.cache.set(`playlist:${playlist.id}`, playlist)));
    }
    return playlists;
  }

  async searchAlbums(query: string): Promise<SpotifyAlbum[]> {
    const [albums, found] = await this.cache.getOrSet(`searchAlbums:${query}`, () => this.api.searchAlbums(query));
    if (!found) {
      await Promise.all(albums.map(album => this.cache.set(`album:${album.id}`, album)));
    }
    return albums;
  }

  async searchArtists(query: string, limit = 5): Promise<SpotifyArtist[]> {
    const [artists, found] = await this.cache.getOrSet(`searchArtists:${query}:${limit}`, () => this.api.searchArtists(query, limit));
    if (!found) {
      await Promise.all(artists.map(artist => this.cache.set(`artist:${artist.id}`, artist)));
    }
    return artists;
  }

}
