import { youtube } from 'api';
import { SOURCE } from 'common/constants';
import { logger } from 'common/logger';
import { fuzzyMatch } from 'common/util';
import { StreamData, Track } from 'music/@types';
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
    const matcher = /(spotify\.com\/|spotify:)(user|track|album|playlist|artist)[:/]([^?]+)/g
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

  async getStream(track: Track): Promise<StreamData | undefined> {
    if (track.src !== SOURCE.SPOTIFY) {
      throw new Error(`Tried to get spotify readable from non-spotify resource: ${JSON.stringify(track)}`);
    }
    const trackCopy: Track = { ...track };

    // Spotify has a format like "Track name - modifier", Ex: "My Song - accoustic" or "My Song - remix"
    // YouTube its more common to do "My Song (accoustic)". So we map to this to improve odds of searching right thing
    const reg = /^\s*(.+)\s+-\s+([^-]+)\s*$/i
    const match = reg.exec(trackCopy.title);
    if (match) {
      trackCopy.title = `${match[1]} (${match[2]})`;
    }

    return youtube.searchStream(trackCopy);
  }

  private async searchUserPlaylists(query: string, userId: string): Promise<SpotifyPlaylist[]> {
    try {
      await this.checkAndUpdateToken();
      const playlists = await this.getAllItems<SpotifyPlaylist>(options => this.get(`users/${userId}/playlists`, options));
      const results = await fuzzyMatch(query, playlists.map(playlist => playlist.name));
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
      this.expiration = Date.now() + data.expires_in * 1000;
    }
  }

  private async getToken(): Promise<{ access_token: string, expires_in: number }> {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    logger.debug(`Spotify HTTP: https://accounts.spotify.com/api/token`);

    const resp = await requestPromise('https://accounts.spotify.com/api/token',
      { method: 'post', body: 'grant_type=client_credentials', json: true, headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }});

    return resp;
  }

  private get<T>(path: string, params = {}, version = SPOTIFY_API_VERSIONS.V1) : Promise<T> {
    return this.getUrl(`${SPOTIFY_API}/${version}/${path}`, params);
  }

  private getUrl<T>(url: string, params = {}) : Promise<T> {
    if (logger.isDebugEnabled()) {
      logger.debug(`Spotify HTTP: ${url} - ${JSON.stringify(params)}`);
    }
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
