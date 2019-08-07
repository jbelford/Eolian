import { EolianBotError } from 'common/errors';
import { logger } from 'common/logger';
import { EolianCache } from 'data/@types';
import { InMemoryCache } from 'data/cache';
import * as fuzz from 'fuzzball';
import SpotifyWebApi from 'spotify-web-api-node';

export interface SpotifyApi {
  resolve(uri: string): SpotifyUrlDetails | undefined
  getUser(id: string): Promise<SpotifyUser>;
  getPlaylist(id: string): Promise<SpotifyPlaylist>;
  getAlbum(id: string): Promise<SpotifyAlbumFull>;
  getAlbumTracks(id: string): Promise<SpotifyAlbumFull>;
  getArtist(id: string): Promise<SpotifyArtist>;
  searchPlaylists(query: string, userId?: string): Promise<SpotifyPlaylist[]>;
  searchAlbums(query: string): Promise<SpotifyAlbum[]>;
  searchArtists(query: string, limit?: number): Promise<SpotifyArtist[]>;
}

export interface SpotifyResponse<T> {
  body: T;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  uri: string;
  external_urls: SpotifyExternalUrls;
}

export interface SpotifyUrlDetails {
  type: SpotifyResourceType;
  id: string;
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  owner: SpotifyUser;
  external_urls: SpotifyExternalUrls;
  images: SpotifyImageObject[];
  tracks?: SpotifyPagingObject<SpotifyPlaylistTrack>;
}

export interface SpotifyAlbum {
  id: string;
  external_urls: SpotifyExternalUrls;
  album_type: 'album' | 'single' | 'compilation';
  artists: SpotifyArtist[];
  images: SpotifyImageObject[];
  name: string;
}

export interface SpotifyAlbumFull extends SpotifyAlbum {
  tracks: SpotifyPagingObject<SpotifyTrack>
}

export interface SpotifyPagingObject<T> {
  href: string;
  items: T[];
  limit: number;
  next: string;
  offset: number;
  previous: string;
  total: number;
}

export interface SpotifySearchResult {
  playlists: SpotifyPagingObject<SpotifyPlaylist>;
  artists: SpotifyPagingObject<SpotifyArtist>;
  albums: SpotifyPagingObject<SpotifyAlbum>;
}

export interface SpotifyPlaylistTrack {
  track: SpotifyTrack;
}

export interface SpotifyImageObject {
  url: string;
  height: number;
  width: number;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  duration_ms: number;
}

export interface SpotifyArtist {
  href: string;
  id: string;
  name: string;
  external_urls: SpotifyExternalUrls;
}

export interface SpotifyExternalUrls {
  spotify: string;
}

export const enum SpotifyResourceType {
  USER = 'user',
  TRACK = 'track',
  PLAYLIST = 'playlist',
  ARTIST = 'artist',
  ALBUM = 'album'
}
export class SpotifyApiImpl implements SpotifyApi {

  private readonly spotify: SpotifyWebApi;
  private expiration = 0;

  constructor(clientId: string, clientSecret: string) {
    this.spotify = new SpotifyWebApi({ clientId, clientSecret });
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
      const response = await this.spotify.getUser(id);
      const user = response.body as SpotifyUser;
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
      const playlist = response.body as SpotifyPlaylist;
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
      const album = response.body as SpotifyAlbumFull;
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
      const artist = response.body as SpotifyArtist;
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
      const body = response.body as unknown as SpotifySearchResult;
      return body.playlists.items;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to search Spotify playlists.');
    }
  }

  async searchAlbums(query: string): Promise<SpotifyAlbum[]> {
    try {
      await this.checkAndUpdateToken();
      const response = await this.spotify.searchAlbums(query, { limit: 5 });
      const body = response.body as unknown as SpotifySearchResult;
      return body.albums.items;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify album.');
    }
  }

  async searchArtists(query: string, limit = 5): Promise<SpotifyArtist[]> {
    try {
      await this.checkAndUpdateToken();
      const response = await this.spotify.searchArtists(query, { limit });
      const body = response.body as unknown as SpotifySearchResult;
      return body.artists.items;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'Failed to fetch Spotify album.');
    }
  }

  private async searchUserPlaylists(query: string, userId: string): Promise<SpotifyPlaylist[]> {
    try {
      await this.checkAndUpdateToken();
      const playlists = await this.getAllItems<SpotifyPlaylist>(options => this.spotify.getUserPlaylists(userId, options) as any);
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
    const limit = 50;
    let data = initial ? initial : (await next({ limit, offset: 0 })).body;
    const total = data.total;
    let items = data.items;
    while (items.length < total) {
      data = (await next({ limit, offset: items.length })).body;
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

  async getAlbum(id: string): Promise<SpotifyAlbumFull> {
    return (await this.cache.getOrSet(`album:${id}`, () => this.api.getAlbum(id)))[0];
  }

  async getAlbumTracks(id: string): Promise<SpotifyAlbumFull> {
    return (await this.cache.getOrSet(`albumTracks:${id}`, () => this.api.getAlbumTracks(id)))[0];
  }

  async getArtist(id: string): Promise<SpotifyArtist> {
    return (await this.cache.getOrSet(`artist:${id}`, () => this.api.getArtist(id)))[0];
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
