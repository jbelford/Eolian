import { youtube } from 'api';
import { SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { logger } from 'common/logger';
import { StreamData, Track } from 'music/@types';
import querystring from 'querystring';
import request from 'request';
import requestp from 'request-promise-native';
import { SoundCloudApi, SoundCloudFavoritesCallback, SoundCloudPaginatedTracks, SoundCloudPlaylist, SoundCloudResource, SoundCloudTrack, SoundCloudUser } from './@types';

const URL = 'https://api.soundcloud.com';

export class SoundCloudApiImpl implements SoundCloudApi {

  constructor(private readonly token: string) {}

  async searchSongs(query: string, limit = 5): Promise<SoundCloudTrack[]> {
    try {
      const tracks: SoundCloudTrack[] = await this.get('tracks', { q: query, access: 'playable,blocked', limit });
      return tracks.slice(0, limit);
    } catch (e) {
      logger.warn(`Failed to search SoundCloud songs: '${query}' limit: '${limit}'`);
      throw e;
    }
  }

  async searchUser(query: string, limit = 5): Promise<SoundCloudUser[]> {
    try {
      const users: SoundCloudUser[] = await this.get('users', { q: query, limit });
      return users.slice(0, limit);
    } catch (e) {
      logger.warn(`Failed to search SoundCloud users: query: '${query}' limit: '${limit}'`);
      throw e;
    }
  }

  async searchPlaylists(query: string, userId?: number): Promise<SoundCloudPlaylist[]> {
    try {
      const playlists: SoundCloudPlaylist[] = await this.get(userId ? `users/${userId}/playlists` : 'playlists',
        { q: query, limit: 5 });
      return playlists.slice(0, 5);
    } catch (e) {
      logger.warn(`Failed to search SoundCloud playlists: query: '${query}', userId: '${userId}'`);
      throw e;
    }
  }

  private async _resolve(url: string, options = {}): Promise<SoundCloudResource> {
    let resource: SoundCloudResource | SoundCloudResource[];
    try {
      resource = await this.get('resolve', { url, ...options });
    } catch (e) {
      logger.warn(`Failed to resolve URL from SoundCloud: url: ${url} options: ${JSON.stringify(options)}`);
      throw e;
    }
    if (resource instanceof Array) {
      throw new EolianUserError('The url provided does not resolve to a specific resource');
    }
    return resource;
  }

  resolve(url: string): Promise<SoundCloudResource> {
    return this._resolve(url);
  }

  async resolveUser(url: string): Promise<SoundCloudUser> {
    const resource = await this._resolve(url);
    if (resource.kind !== 'user') {
      throw new EolianUserError('The url provided is not a SoundCloud user');
    }
    return resource as SoundCloudUser;
  }

  async resolvePlaylist(url: string): Promise<SoundCloudPlaylist> {
    const resource = await this._resolve(url, { representation: 'compact '});
    if (resource.kind !== 'playlist') {
      throw new EolianUserError('The url provided is not a SoundCloud playlist');
    }
    return resource as SoundCloudPlaylist;
  }

  async getUser(id: number): Promise<SoundCloudUser> {
    try {
      const user: SoundCloudUser = await this.get(`users/${id}`);
      return user;
    } catch (e) {
      logger.warn(`Failed to fetch SoundCloud user profile: id: ${id}`);
      throw e;
    }
  }


  async getTrack(id: number): Promise<SoundCloudTrack> {
    try {
      return await this.get<SoundCloudTrack>(`tracks/${id}`);
    } catch (e) {
      logger.warn(`Failed to fetch SoundCloud track: id: ${id}`);
      throw e;
    }
  }

  async getPlaylist(id: number): Promise<SoundCloudPlaylist> {
    try {
      return await this.get<SoundCloudPlaylist>(`playlists/${id}`, { access: 'playable,blocked' });
    } catch (e) {
      logger.warn(`Failed to fetch SoundCloud playlist: id: ${id}`);
      throw e;
    }
  }

  async getUserTracks(id: number): Promise<SoundCloudTrack[]> {
    try {
      return await this.get<SoundCloudTrack[]>(`users/${id}/tracks`, { access: 'playable,blocked' });
    } catch (e) {
      logger.warn(`Failed to fetch SoundCloud user's track: id: ${id}`);
      throw e;
    }
  }

  async getUserFavorites(id: number, max?: number, progressCb?: SoundCloudFavoritesCallback): Promise<SoundCloudTrack[]> {
    try {
      let progressPromise = Promise.resolve();
      let tracks: SoundCloudTrack[] = [];

      let result = await this.get<SoundCloudPaginatedTracks>(`users/${id}/likes/tracks`, { access: 'playable,blocked', linked_partitioning: true, limit: 200 });
      tracks = tracks.concat(result.collection);

      if (progressCb) {
        const curr = tracks.length;
        progressPromise = progressPromise.then(() => progressCb(curr));
      }

      while (result.next_href && (!max || tracks.length < max)) {
        result = await this.getUri<SoundCloudPaginatedTracks>(`${result.next_href}&client_id=${this.token}`);
        tracks = tracks.concat(result.collection);
        if (progressCb) {
          const curr = tracks.length;
          progressPromise = progressPromise.then(() => progressCb(curr));
        }
      }

      await progressPromise;

      return tracks;
    } catch (e) {
      logger.warn(`Failed to fetch SoundCloud user's liked tracks: ${id}`);
      throw e;
    }
  }

  getStream(track: Track): Promise<StreamData | undefined> {
    if (track.src !== SOURCE.SOUNDCLOUD) {
      throw new Error(`Tried to get soundcloud readable from non-soundcloud resource: ${JSON.stringify(track)}`);
    }

    // Use youtube for premium songs
    if (!track.stream) {
      return youtube.searchStream(track);
    }

    return new Promise<StreamData>((resolve, reject) => {
      const stream = request(`${track.stream}?client_id=${this.token}`);
      stream.once('response', resp => {
        if (resp.statusCode < 200 || resp.statusCode >= 400) {
          logger.error(`Error occured on request: ${track.stream}`);
          return reject(resp.statusMessage);
        }

        const contentLength = Number(resp.headers["content-length"]);
        if (isNaN(contentLength)) return reject('Could not parse content-length from SoundCloud stream');

        resp.pause();

        resolve({ readable: resp, details: track });
      });
    });
  }

  private async get<T>(endpoint: string, params: { [key: string]: string | number | boolean } = {}): Promise<T> {
    params.client_id = this.token;
    return this.getUri<T>(`${URL}/${endpoint}?${querystring.stringify(params)}`);
  }

  private async getUri<T>(uri: string): Promise<T> {
    logger.debug(`SoundCloud HTTP: ${uri}`);
    const data = await requestp(uri);
    return JSON.parse(data);
  }

}
