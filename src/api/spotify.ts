import environment from 'common/env';
import { EolianBotError } from 'common/errors';
import { logger } from 'common/logger';
import { InMemoryCache } from 'data/memory/cache';
import * as fuzz from 'fuzzball';
import * as SpotifyWebApi from 'spotify-web-api-node';

export const enum SpotifyResourceType {
  USER = 'user',
  TRACK = 'track',
  PLAYLIST = 'playlist',
  ARTIST = 'artist',
  ALBUM = 'album'
}

interface SpotifyApi {

  getUser(id: string): Promise<SpotifyUser>;
  getPlaylist(id: string): Promise<SpotifyPlaylist>;
  getAlbum(id: string): Promise<SpotifyAlbumFull>;
  getAlbumTracks(id: string): Promise<SpotifyAlbumFull>;
  getArtist(id: string): Promise<SpotifyArtist>;
  searchPlaylists(query: string, userId?: string): Promise<SpotifyPlaylist[]>;
  searchAlbums(query: string): Promise<SpotifyAlbum[]>;
  searchArtists(query: string, limit?: number): Promise<SpotifyArtist[]>;

}

class SpotifyApiImpl implements SpotifyApi {

  private readonly spotify: SpotifyWebApi;
  private expiration = 0;

  constructor(clientId: string, clientSecret: string) {
    this.spotify = new SpotifyWebApi({ clientId, clientSecret });
  }

  async getUser(id: string): Promise<SpotifyUser> {
    try {
      logger.debug(`Getting user: ${id}`);
      await this.checkAndUpdateToken();
      const response = await this.spotify.getUser(id);
      const user = <SpotifyUser>response.body;
      return user;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify user.');
    }
  }

  async getPlaylist(id: string): Promise<SpotifyPlaylist> {
    try {
      logger.debug(`Getting playlist: ${id}`);
      await this.checkAndUpdateToken();
      const response = await this.spotify.getPlaylist(id, { fields: 'id,name,owner,external_urls' });
      const playlist = <SpotifyPlaylist>response.body;
      return playlist;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify playlist.');
    }
  }

  async getAlbum(id: string): Promise<SpotifyAlbumFull> {
    try {
      logger.debug(`Getting album: ${id}`);
      await this.checkAndUpdateToken();
      const response = await this.spotify.getAlbum(id);
      const album = <SpotifyAlbumFull>response.body;
      return album;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify album.');
    }
  }

  async getAlbumTracks(id: string): Promise<SpotifyAlbumFull> {
    try {
      const album = await this.getAlbum(id);
      album.tracks.items = await this.getAllItems(options => this.spotify.getAlbumTracks(id, options), album.tracks);
      return album;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify album tracks.');
    }
  }

  async getArtist(id: string): Promise<SpotifyArtist> {
    try {
      logger.debug(`Getting artist: ${id}`);
      await this.checkAndUpdateToken();
      const response = await this.spotify.getArtist(id);
      const artist = <SpotifyArtist>response.body;
      return artist;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify artist.');
    }
  }

  async searchPlaylists(query: string, userId?: string): Promise<SpotifyPlaylist[]> {
    if (userId) return this.searchUserPlaylists(query, userId);
    try {
      await this.checkAndUpdateToken();
      const response = await this.spotify.searchPlaylists(query, { limit: 5 });
      const body = <SpotifySearchResult>response.body;
      return body.playlists.items;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to search Spotify playlists.');
    }
  }

  async searchAlbums(query: string): Promise<SpotifyAlbum[]> {
    try {
      await this.checkAndUpdateToken();
      const response = await this.spotify.searchAlbums(query, { limit: 5 });
      const body = <SpotifySearchResult>response.body;
      return body.albums.items;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify album.');
    }
  }

  async searchArtists(query: string, limit = 5): Promise<SpotifyArtist[]> {
    try {
      await this.checkAndUpdateToken();
      const response = await this.spotify.searchArtists(query, { limit });
      const body = <SpotifySearchResult>response.body;
      return body.artists.items;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify album.');
    }
  }

  private async searchUserPlaylists(query: string, userId: string): Promise<SpotifyPlaylist[]> {
    try {
      await this.checkAndUpdateToken();
      const playlists = await this.getAllItems<SpotifyPlaylist>(options => this.spotify.getUserPlaylists(userId, options));
      const results = await fuzz.extractAsPromised(query, playlists.map(playlist => playlist.name),
          { scorer: fuzz.token_sort_ratio, returnObjects: true });
      return results.slice(0, 5).map(result => playlists[result.key]);
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify user playlists.');
    }
  }

  private async checkAndUpdateToken() {
    if (Date.now() + 1000 >= this.expiration) {
      const data = await this.spotify.clientCredentialsGrant();
      this.expiration = Date.now() + data.body.expires_in;
      this.spotify.setAccessToken(data.body.access_token);
    }
  }

  private async getAllItems<T>(
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

}

class CachedSpotifyApi implements SpotifyApi {

  private readonly api: SpotifyApi;
  private readonly cache: EolianCache<any>;

  constructor(clientId: string, clientSecret: string, ttl: number) {
    this.api = new SpotifyApiImpl(clientId, clientSecret);
    this.cache = new InMemoryCache(ttl);
  }

  getUser(id: string): Promise<SpotifyUser> {
    return this.cache.getOrSet(`getUser:${id}`, () => this.api.getUser(id));
  }

  getPlaylist(id: string): Promise<SpotifyPlaylist> {
    return this.cache.getOrSet(`getPlaylist:${id}`, () => this.api.getPlaylist(id));
  }

  getAlbum(id: string): Promise<SpotifyAlbumFull> {
    return this.cache.getOrSet(`getAlbum:${id}`, () => this.api.getAlbum(id));
  }

  getAlbumTracks(id: string): Promise<SpotifyAlbumFull> {
    return this.cache.getOrSet(`getAlbumTracks:${id}`, () => this.api.getAlbumTracks(id));
  }

  getArtist(id: string): Promise<SpotifyArtist> {
    return this.cache.getOrSet(`getArtist:${id}`, () => this.api.getArtist(id));
  }

  searchPlaylists(query: string, userId?: string): Promise<SpotifyPlaylist[]> {
    let key = `searchPlaylists:${query}`;
    if (userId) key = `${key}:${userId}`;
    return this.cache.getOrSet(key, () => this.api.searchPlaylists(query));
  }

  searchAlbums(query: string): Promise<SpotifyAlbum[]> {
    return this.cache.getOrSet(`searchAlbums:${query}`, () => this.api.searchAlbums(query));
  }

  searchArtists(query: string, limit = 5): Promise<SpotifyArtist[]> {
    return this.cache.getOrSet(`searchArtists:${query}:${limit}`, () => this.api.searchArtists(query, limit));
  }

}


export namespace Spotify {

  export const API: SpotifyApi = new CachedSpotifyApi(environment.tokens.spotify.clientId,
      environment.tokens.spotify.clientSecret, 1000 * 30);

  export function getResourceType(uri: string): SpotifyUrlDetails | undefined {
    const matcher = /(spotify\.com\/|spotify:)(user|track|album|playlist|artist)[:\/]([^\?]+)/g
    const regArr = matcher.exec(uri);
    if (!regArr) return null;
    return { type: regArr[2] as SpotifyResourceType, id: regArr[3] };
  }

}