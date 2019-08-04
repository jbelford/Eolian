import { IDENTIFIER_TYPE, SOURCE } from 'common/constants';
import environment from "common/env";
import { EolianBotError } from 'common/errors';
import { logger } from 'common/logger';
import { InMemoryCache } from 'data/memory/cache';
import * as querystring from 'querystring';
import * as request from 'request';
import * as requestp from 'request-promise-native';


export const enum SoundCloudResourceType {
  USER = 'user',
  PLAYLIST = 'playlist',
  TRACK = 'track'
};

interface SoundCloudApi {

  searchSongs(query: string, limit?: number): Promise<SoundCloudTrack[]>;
  searchUser(query: string, limit?: number): Promise<SoundCloudUser[]>;
  searchPlaylists(query: string, userId?: number): Promise<SoundCloudPlaylist[]>;
  resolve(url: string): Promise<SoundCloudResource>;
  resolveUser(url: string): Promise<SoundCloudUser>;
  resolvePlaylist(url: string): Promise<SoundCloudPlaylist>;
  getUser(id: number): Promise<SoundCloudUser>;
  getStream(track: Track): Promise<StreamData>;

}

const API = 'https://api.soundcloud.com';

class SoundCloudApiImpl implements SoundCloudApi {

  constructor(private readonly token: string) {}

  async searchSongs(query: string, limit = 5): Promise<SoundCloudTrack[]> {
    try {
      const tracks: SoundCloudTrack[] = await this.get('tracks', { q: query });
      return tracks.slice(0, limit);
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'I failed to search SoundCloud');
    }
  }

  async searchUser(query: string, limit = 5): Promise<SoundCloudUser[]> {
    try {
      const users: SoundCloudUser[] = await this.get('users', { q: query });
      return users.slice(0, limit);
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'I failed to search SoundCloud');
    }
  }

  async searchPlaylists(query: string, userId?: number): Promise<SoundCloudPlaylist[]> {
    try {
      const playlists: SoundCloudPlaylist[] = await this.get(userId ? `users/${userId}/playlists` : 'playlists',
        { q: query, representation: 'compact' });
      return playlists.slice(0, 5);
    } catch (e) {
      throw new EolianBotError(e.stack || e, `Failed to search SoundCloud playlists.`);
    }
  }

  async resolve(url: string): Promise<SoundCloudResource> {
    try {
      return await this.get('resolve', { url: url });
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'I failed to resolve the URL from SoundCloud');
    }
  }

  async resolveUser(url: string): Promise<SoundCloudUser> {
    try {
      const resource: SoundCloudResource = await this.get('resolve', { url: url });
      if (resource.kind !== 'user') throw new EolianBotError('The url provided is not a SoundCloud user');
      return resource as SoundCloudUser;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'I failed to resolve the URL from SoundCloud');
    }
  }

  async resolvePlaylist(url: string): Promise<SoundCloudPlaylist> {
    try {
      const resource: SoundCloudResource = await this.get('resolve', { url: url, representation: 'compact' });
      if (resource.kind !== 'playlist') throw new EolianBotError('The url provided is not a SoundCloud playlist');
      return resource as SoundCloudPlaylist;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'I failed to resolve the URL from SoundCloud');
    }
  }

  async getUser(id: number): Promise<SoundCloudUser> {
    try {
      const user: SoundCloudUser = await this.get(`users/${id}`);
      return user;
    } catch (e) {
      throw new EolianBotError(e.stack || e, `Failed to fetch SoundCloud user profile.`);
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
          logger.error(`[stream.service.ts] Error occured on request: ${track.stream}`);
          return reject(resp.statusMessage);
        }

        const contentLength = parseInt(resp.headers["content-length"]);
        if (isNaN(contentLength)) return reject('Could not parse content-length from SoundCloud stream');

        const streamData: StreamData = { readable: stream as any, size: contentLength, details: track };
        resolve(streamData);
      });
    });
  }

  private async get(endpoint: string, params: any = {}) {
    params.client_id = this.token;
    const data = await requestp(`${API}/${endpoint}?${querystring.stringify(params)}`);
    return JSON.parse(data);
  }

}

class CachedSoundCloudApi implements SoundCloudApi {

  private readonly api: SoundCloudApi;
  private readonly cache: EolianCache<any>;

  constructor(token: string, ttl: number) {
    this.api = new SoundCloudApiImpl(token);
    this.cache = new InMemoryCache(ttl);
  }

  searchSongs(query: string, limit = 5): Promise<SoundCloudTrack[]> {
    return this.cache.getOrSet(`searchSongs:${query}:${limit}`, () => this.api.searchSongs(query, limit));
  }

  searchUser(query: string, limit = 5): Promise<SoundCloudUser[]> {
    return this.cache.getOrSet(`searchUser:${query}:${limit}`, () => this.api.searchUser(query, limit));
  }

  searchPlaylists(query: string, userId?: number): Promise<SoundCloudPlaylist[]> {
    let key = `searchPlaylists:${query}`;
    if (userId) key = `${key}:${userId}`;
    return this.cache.getOrSet(key, () => this.api.searchPlaylists(query, userId));
  }

  resolve(url: string): Promise<SoundCloudResource> {
    return this.cache.getOrSet(`resolve:${url}`, () => this.api.resolve(url));
  }

  resolveUser(url: string): Promise<SoundCloudUser> {
    return this.cache.getOrSet(`resolveUser:${url}`, () => this.api.resolveUser(url));
  }

  resolvePlaylist(url: string): Promise<SoundCloudPlaylist> {
    return this.cache.getOrSet(`resolvePlaylist:${url}`, () => this.api.resolvePlaylist(url));
  }

  getUser(id: number): Promise<SoundCloudUser> {
    return this.cache.getOrSet(`getUser:${id}`, () => this.api.getUser(id));
  }

  getStream(track: Track): Promise<StreamData> {
    return this.api.getStream(track);
  }

}

export namespace SoundCloud {

  export const API: SoundCloudApi = new CachedSoundCloudApi(environment.tokens.soundcloud, 1000 * 30);

  export function createIdentifier(resource: SoundCloudResource): Identifier {
    return {
      id: resource.id.toString(),
      src: SOURCE.SOUNDCLOUD,
      type: getIdentifierType(resource.kind),
      url: resource.permalink_url
    };
  }

  function getIdentifierType(type: SoundCloudResourceType): IDENTIFIER_TYPE {
    switch (type) {
      case SoundCloudResourceType.PLAYLIST: return IDENTIFIER_TYPE.PLAYLIST;
      case SoundCloudResourceType.TRACK: return IDENTIFIER_TYPE.TRACKS;
      case SoundCloudResourceType.USER: return IDENTIFIER_TYPE.ARTIST;
      default: return null;
    }
  }

}