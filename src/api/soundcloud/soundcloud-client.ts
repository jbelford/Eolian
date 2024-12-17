import { ProgressUpdater } from '@eolian/common/@types';
import { EolianUserError } from '@eolian/common/errors';
import { logger } from '@eolian/common/logger';
import { querystringify } from '@eolian/http';
import { IOAuthHttpClient } from '@eolian/http/@types';
import { Track, StreamSource, TrackSource } from '../@types';
import { youtube } from '../youtube';
import { IYouTubeApi } from '../youtube/@types';
import {
  ISoundCloudApi,
  SoundCloudUser,
  SoundCloudResource,
  SoundCloudPaginatedResult,
  SoundCloudTrack,
  SoundCloudPlaylist,
} from './@types';
import { CLIENT_SOUNDCLOUD_REQUEST } from './soundcloud-request';
import { SoundCloudStreamSource } from './soundcloud-stream-source';

const TRACKS_PARAMS = {
  access: 'playable,blocked,preview',
};

class SoundCloudApi implements ISoundCloudApi {
  constructor(
    private readonly youtube: IYouTubeApi,
    private readonly req: IOAuthHttpClient = CLIENT_SOUNDCLOUD_REQUEST,
  ) {}

  async getMe(): Promise<SoundCloudUser> {
    try {
      return await this.req.get('me');
    } catch (e) {
      logger.warn('Failed to get current SoundCloud user');
      throw e;
    }
  }

  async getMyTracks(): Promise<SoundCloudTrack[]> {
    try {
      const user = await this.getMe();
      return await this.getPaginatedItems<SoundCloudTrack>(`me/tracks`, {
        total: user.track_count,
        params: TRACKS_PARAMS,
      });
    } catch (e) {
      logger.warn(`Failed to fetch current SoundCloud user's track`);
      throw e;
    }
  }

  async getMyFavorites(max?: number, progress?: ProgressUpdater): Promise<SoundCloudTrack[]> {
    try {
      return await this.getPaginatedItems<SoundCloudTrack>(`me/likes/tracks`, {
        total: max,
        progress,
        params: TRACKS_PARAMS,
      });
    } catch (e) {
      logger.warn(`Failed to fetch current SoundCloud user's liked tracks`);
      throw e;
    }
  }

  async searchMyPlaylists(query: string, limit?: number): Promise<SoundCloudPlaylist[]> {
    try {
      return await this.getPaginatedItems<SoundCloudPlaylist>('me/playlists', {
        params: { ...TRACKS_PARAMS, q: query },
        total: limit,
        requestLimit: 1,
      });
    } catch (e) {
      logger.warn('Failed to search current SoundCloud playlists: query: %s', query);
      throw e;
    }
  }

  async searchSongs(query: string, limit = 5): Promise<SoundCloudTrack[]> {
    try {
      return await this.getPaginatedItems<SoundCloudTrack>('tracks', {
        params: { ...TRACKS_PARAMS, q: query },
        total: limit,
        requestLimit: 1,
      });
    } catch (e) {
      logger.warn('Failed to search SoundCloud songs: %s limit: %d', query, limit);
      throw e;
    }
  }

  async searchUser(query: string, limit = 5): Promise<SoundCloudUser[]> {
    try {
      return await this.getPaginatedItems<SoundCloudUser>('users', {
        params: { q: query },
        total: limit,
        requestLimit: 1,
      });
    } catch (e) {
      logger.warn('Failed to search SoundCloud users: query: %s limit: %d', query, limit);
      throw e;
    }
  }

  async searchPlaylists(query: string, limit = 5, userId?: number): Promise<SoundCloudPlaylist[]> {
    try {
      const path = userId ? `users/${userId}/playlists` : 'playlists';
      return await this.getPaginatedItems<SoundCloudPlaylist>(path, {
        params: { ...TRACKS_PARAMS, q: query },
        total: limit,
        requestLimit: 1,
      });
    } catch (e) {
      logger.warn('Failed to search SoundCloud playlists: query: %s, userId: %s', query, userId);
      throw e;
    }
  }

  private async _resolve(url: string, options = {}): Promise<SoundCloudResource> {
    let resource: SoundCloudResource | SoundCloudResource[];
    try {
      resource = await this.req.get('resolve', { url, ...options });
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
      const user: SoundCloudUser = await this.req.get(`users/${id}`);
      return user;
    } catch (e) {
      logger.warn('Failed to fetch SoundCloud user profile: id: %d', id);
      throw e;
    }
  }

  async getTrack(id: number): Promise<SoundCloudTrack> {
    try {
      return await this.req.get<SoundCloudTrack>(`tracks/${id}`);
    } catch (e) {
      logger.warn('Failed to fetch SoundCloud track: id: %d', id);
      throw e;
    }
  }

  async getPlaylist(id: number): Promise<SoundCloudPlaylist> {
    try {
      return await this.req.get<SoundCloudPlaylist>(`playlists/${id}`, TRACKS_PARAMS);
    } catch (e) {
      logger.warn('Failed to fetch SoundCloud playlist: id: %d', id);
      throw e;
    }
  }

  async getUserTracks(id: number): Promise<SoundCloudTrack[]> {
    try {
      const user = await this.getUser(id);
      return await this.getPaginatedItems<SoundCloudTrack>(`users/${id}/tracks`, {
        total: user.track_count,
        params: TRACKS_PARAMS,
      });
    } catch (e) {
      logger.warn(`Failed to fetch SoundCloud user's track: id: %d`, id);
      throw e;
    }
  }

  async getUserFavorites(
    id: number,
    max?: number,
    progress?: ProgressUpdater,
  ): Promise<SoundCloudTrack[]> {
    try {
      return await this.getPaginatedItems<SoundCloudTrack>(`users/${id}/likes/tracks`, {
        total: max,
        progress,
        params: TRACKS_PARAMS,
      });
    } catch (e) {
      logger.warn(`Failed to fetch SoundCloud user's liked tracks: %d`, id);
      throw e;
    }
  }

  private async getPaginatedItems<T>(
    path: string,
    options: GetPaginatedItemsOptions = {},
  ): Promise<T[]> {
    let items: T[] = [];

    options.progress?.init(options.total);

    const params = options.params ?? {};

    let limit = 200;
    if (options.total) {
      limit = Math.min(limit, options.total);
    }
    let result = await this.req.get<SoundCloudPaginatedResult<T>>(path, {
      ...params,
      linked_partitioning: true,
      limit,
    });
    items = items.concat(result.collection);

    options.progress?.update(items.length);

    const extraParams = querystringify(params);

    let requests = 1;
    while (
      result.next_href &&
      (!options.total || items.length < options.total) &&
      (!options.requestLimit || requests < options.requestLimit)
    ) {
      result = await this.req.getUri<SoundCloudPaginatedResult<T>>(
        `${result.next_href}&${extraParams}`,
      );
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
    if (track.src !== TrackSource.SoundCloud) {
      throw new Error(
        `Tried to get soundcloud readable from non-soundcloud resource: ${JSON.stringify(track)}`,
      );
    }

    // Use youtube for premium songs
    if (!track.stream) {
      return await this.youtube.searchStream(track);
    }

    return new SoundCloudStreamSource(this.req, track.url, track.stream);
  }
}

type GetPaginatedItemsOptions = {
  params?: any;
  total?: number;
  requestLimit?: number;
  progress?: ProgressUpdater;
};

export const soundcloud: ISoundCloudApi = new SoundCloudApi(youtube);

export function createSoundCloudClient(request: IOAuthHttpClient): ISoundCloudApi {
  return new SoundCloudApi(youtube, request);
}
