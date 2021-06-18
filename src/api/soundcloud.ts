import { ProgressUpdater } from 'common/@types';
import { SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { logger } from 'common/logger';
import querystring from 'querystring';
import request from 'request';
import requestp from 'request-promise-native';
import { Readable } from 'stream';
import { SoundCloudApi, SoundCloudPaginatedResult, SoundCloudPlaylist, SoundCloudResource, SoundCloudTrack, SoundCloudUser, StreamSource, Track, YouTubeApi } from './@types';

const SOUNDCLOUD_API = 'https://api.soundcloud.com';
const TRACKS_PARAMS = {
  access: 'playable,blocked,preview'
};

export class SoundCloudApiImpl implements SoundCloudApi {

  constructor(private readonly token: string, private readonly youtube: YouTubeApi) {}

  async searchSongs(query: string, limit = 5): Promise<SoundCloudTrack[]> {
    try {
      return await this.getPaginatedItems<SoundCloudTrack>('tracks', { params: { ...TRACKS_PARAMS, q: query }, total: limit, requestLimit: 1 });
    } catch (e) {
      logger.warn('Failed to search SoundCloud songs: %s limit: %d', query, limit);
      throw e;
    }
  }

  async searchUser(query: string, limit = 5): Promise<SoundCloudUser[]> {
    try {
      return await this.getPaginatedItems<SoundCloudUser>('users', { params: { q: query }, total: limit, requestLimit: 1 });
    } catch (e) {
      logger.warn('Failed to search SoundCloud users: query: %s limit: %d', query, limit);
      throw e;
    }
  }

  async searchPlaylists(query: string, userId?: number): Promise<SoundCloudPlaylist[]> {
    try {
      const path = userId ? `users/${userId}/playlists` : 'playlists'
      return await this.getPaginatedItems<SoundCloudPlaylist>(path, { params: { ...TRACKS_PARAMS, q: query }, total: 5, requestLimit: 1 });
    } catch (e) {
      logger.warn('Failed to search SoundCloud playlists: query: %s, userId: %s', query, userId);
      throw e;
    }
  }

  private async _resolve(url: string, options = {}): Promise<SoundCloudResource> {
    let resource: SoundCloudResource | SoundCloudResource[];
    try {
      resource = await this.get('resolve', { url, ...options });
    } catch (e) {
      logger.warn('Failed to resolve URL from SoundCloud: url: %s options: %s', url, options);
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

  async getUser(id: number): Promise<SoundCloudUser> {
    try {
      const user: SoundCloudUser = await this.get(`users/${id}`);
      return user;
    } catch (e) {
      logger.warn('Failed to fetch SoundCloud user profile: id: %d', id);
      throw e;
    }
  }


  async getTrack(id: number): Promise<SoundCloudTrack> {
    try {
      return await this.get<SoundCloudTrack>(`tracks/${id}`);
    } catch (e) {
      logger.warn('Failed to fetch SoundCloud track: id: %d', id);
      throw e;
    }
  }

  async getPlaylist(id: number): Promise<SoundCloudPlaylist> {
    try {
      return await this.get<SoundCloudPlaylist>(`playlists/${id}`, TRACKS_PARAMS);
    } catch (e) {
      logger.warn('Failed to fetch SoundCloud playlist: id: %d', id);
      throw e;
    }
  }

  async getUserTracks(id: number): Promise<SoundCloudTrack[]> {
    try {
      const user = await this.getUser(id);
      return await this.getPaginatedItems<SoundCloudTrack>(`users/${id}/tracks`, { total: user.track_count, params: TRACKS_PARAMS });
    } catch (e) {
      logger.warn(`Failed to fetch SoundCloud user's track: id: %d`, id);
      throw e;
    }
  }

  async getUserFavorites(id: number, max?: number, progress?: ProgressUpdater): Promise<SoundCloudTrack[]> {
    try {
      return await this.getPaginatedItems<SoundCloudTrack>(`users/${id}/likes/tracks`, { total: max, progress, params: TRACKS_PARAMS });
    } catch (e) {
      logger.warn(`Failed to fetch SoundCloud user's liked tracks: %d`, id);
      throw e;
    }
  }

  private async getPaginatedItems<T>(path: string, options: GetPaginatedItemsOptions = {}): Promise<T[]> {
    let items: T[] = [];

    options.progress?.init(options.total);

    const params = options.params ?? {};

    let limit = 200;
    if (options.total) {
      limit = Math.min(limit, options.total);
    }
    let result = await this.get<SoundCloudPaginatedResult<T>>(path, { ...params, linked_partitioning: true, limit });
    items = items.concat(result.collection);

    options.progress?.update(items.length);

    const extraParams = querystring.stringify({ ...params, client_id: this.token });

    let requests = 1;
    while (result.next_href && (!options.total || items.length < options.total) && (!options.requestLimit || requests < options.requestLimit)) {
      result = await this.getUri<SoundCloudPaginatedResult<T>>(`${result.next_href}&${extraParams}`);
      items = items.concat(result.collection);
      options.progress?.update(items.length);
      requests++;
    }

    await options.progress?.done();

    if (options.total && items.length > options.total) {
      items = items.slice(0, options.total);
    }

    return items;
  }

  async getStream(track: Track): Promise<StreamSource | undefined> {
    if (track.src !== SOURCE.SOUNDCLOUD) {
      throw new Error(`Tried to get soundcloud readable from non-soundcloud resource: ${JSON.stringify(track)}`);
    }

    // Use youtube for premium songs
    if (!track.stream) {
      return await this.youtube.searchStream(track);
    }

    logger.info('Getting soundcloud stream %s', track.url);

    return new SoundCloudStreamSource(this.token, track.url, track.stream);
  }

  private async get<T>(endpoint: string, params: { [key: string]: string | number | boolean } = {}): Promise<T> {
    params.client_id = this.token;
    return this.getUri<T>(`${SOUNDCLOUD_API}/${endpoint}?${querystring.stringify(params)}`);
  }

  private async getUri<T>(uri: string): Promise<T> {
    logger.info(`SoundCloud HTTP: %s`, uri);
    const data = await requestp(uri);
    return JSON.parse(data);
  }

}

type GetPaginatedItemsOptions = {
  params?: any;
  total?: number;
  requestLimit?: number;
  progress?: ProgressUpdater;
};

export function mapSoundCloudTrack(track: SoundCloudTrack): Track {
  return {
    id: track.id.toString(),
    poster: track.user.username,
    src: SOURCE.SOUNDCLOUD,
    url: track.permalink_url,
    stream: track.streamable && track.access === 'playable' ? track.stream_url : undefined,
    title: track.title,
    artwork: track.artwork_url && track.artwork_url.replace('large', 't500x500'),
    duration: track.duration
  };
}

class SoundCloudStreamSource implements StreamSource {

  constructor(private readonly token: string,
    private readonly url: string,
    private readonly stream: string) {
  }

  get(): Promise<Readable> {
    logger.info('Getting soundcloud stream %s', this.url);

    return new Promise<Readable>((resolve, reject) => {
      const stream = request(`${this.stream}?client_id=${this.token}`);
      stream.once('response', resp => {
        if (resp.statusCode < 200 || resp.statusCode >= 400) {
          logger.warn(`Error occured on request: %s`, this.stream);
          return reject(resp.statusMessage);
        }

        const contentLength = Number(resp.headers["content-length"]);
        if (isNaN(contentLength)) return reject('Could not parse content-length from SoundCloud stream');

        resp.pause();

        resolve(resp);
      });
    });
  }

}