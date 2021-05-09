import { SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { logger } from 'common/logger';
import { StreamData, Track } from 'music/@types';
import querystring from 'querystring';
import request from 'request';
import requestp from 'request-promise-native';
import { Readable } from 'stream';
import { SoundCloudApi, SoundCloudPlaylist, SoundCloudResource, SoundCloudTrack, SoundCloudUser } from './@types';

const URL = 'https://api.soundcloud.com';

export class SoundCloudApiImpl implements SoundCloudApi {

  constructor(private readonly token: string) {}

  async searchSongs(query: string, limit = 5): Promise<SoundCloudTrack[]> {
    try {
      const tracks: SoundCloudTrack[] = await this.get('tracks', { q: query });
      return tracks.slice(0, limit);
    } catch (e) {
      logger.warn(`Failed to search SoundCloud songs: '${query}' limit: '${limit}'`);
      throw e;
    }
  }

  async searchUser(query: string, limit = 5): Promise<SoundCloudUser[]> {
    try {
      const users: SoundCloudUser[] = await this.get('users', { q: query });
      return users.slice(0, limit);
    } catch (e) {
      logger.warn(`Failed to search SoundCloud users: query: '${query}' limit: '${limit}'`);
      throw e;
    }
  }

  async searchPlaylists(query: string, userId?: number): Promise<SoundCloudPlaylist[]> {
    try {
      const playlists: SoundCloudPlaylist[] = await this.get(userId ? `users/${userId}/playlists` : 'playlists',
        { q: query, representation: 'compact' });
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
      return await this.get<SoundCloudPlaylist>(`playlists/${id}`);
    } catch (e) {
      logger.warn(`Failed to fetch SoundCloud playlist: id: ${id}`);
      throw e;
    }
  }

  async getUserTracks(id: number): Promise<SoundCloudTrack[]> {
    try {
      return await this.get<SoundCloudTrack[]>(`users/${id}/tracks`);
    } catch (e) {
      logger.warn(`Failed to fetch SoundCloud user's track: id: ${id}`);
      throw e;
    }
  }

  getStream(track: Track): Promise<StreamData> {
    if (track.src !== SOURCE.SOUNDCLOUD) {
      throw new Error(`Tried to get soundcloud readable from non-soundcloud resource: ${JSON.stringify(track)}`);
    }
    return new Promise<StreamData>((resolve, reject) => {
      const stream = request(`${track.stream}?client_id=${this.token}`);
      stream.on('response', resp => {
        if (resp.statusCode < 200 || resp.statusCode >= 400) {
          logger.error(`Error occured on request: ${track.stream}`);
          return reject(resp.statusMessage);
        }

        const contentLength = Number(resp.headers["content-length"]);
        if (isNaN(contentLength)) return reject('Could not parse content-length from SoundCloud stream');

        const streamData: StreamData = { readable: stream as unknown as Readable, size: contentLength, details: track };
        resolve(streamData);
      });
    });
  }

  private async get<T>(endpoint: string, params: { [key: string]: string } = {}): Promise<T> {
    params.client_id = this.token;
    const data = await requestp(`${URL}/${endpoint}?${querystring.stringify(params)}`);
    return JSON.parse(data);
  }

}
