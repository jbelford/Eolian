import { ProgressUpdater } from '@eolian/common/@types';
import { logger } from '@eolian/common/logger';
import { fuzzyMatch } from '@eolian/common/util';
import { IOAuthHttpClient } from '@eolian/http/@types';
import { RangeFactory, Track, StreamSource, TrackSource } from '../@types';
import { youtube } from '../youtube';
import { IYouTubeApi } from '../youtube/@types';
import {
  ISpotifyApi,
  SpotifyUrlDetails,
  SpotifyResourceType,
  SpotifyUser,
  SpotifyUserTrack,
  SpotifyPlaylistTracks,
  SpotifyAlbumFull,
  SpotifyArtist,
  SpotifyPagingObject,
  SpotifyTrack,
  SpotifyPlaylist,
  SpotifyAlbum,
  SpotifyTimeRange,
} from './@types';
import { CLIENT_SPOTIFY_REQUEST } from './spotify-request';

class SpotifyApi implements ISpotifyApi {
  constructor(
    private readonly youtube: IYouTubeApi,
    private readonly req: IOAuthHttpClient = CLIENT_SPOTIFY_REQUEST,
  ) {}

  resolve(uri: string): SpotifyUrlDetails | undefined {
    const matcher = /(spotify\.com\/|spotify:)(user|track|album|playlist|artist)[:/]([^?]+)/g;
    const regArr = matcher.exec(uri);
    if (!regArr) return;
    return { type: regArr[2] as SpotifyResourceType, id: regArr[3] };
  }

  async getMe(): Promise<SpotifyUser> {
    try {
      return await this.req.get<SpotifyUser>(`me`);
    } catch (e) {
      logger.warn(`Failed to fetch current Spotify user`);
      throw e;
    }
  }

  async getMyTracks(
    progress?: ProgressUpdater,
    rangeFn?: RangeFactory,
  ): Promise<SpotifyUserTrack[]> {
    try {
      return await this.getPaginatedItems('me/tracks', { progress, limit: 50, rangeFn });
    } catch (e) {
      logger.warn('Failed to fetch current Spotify user tracks');
      throw e;
    }
  }

  async getMyTopTracks(range = SpotifyTimeRange.MEDIUM): Promise<SpotifyTrack[]> {
    try {
      return await this.getPaginatedItems('me/top/tracks', {
        limit: 50,
        params: { time_range: range },
      });
    } catch (e) {
      logger.warn('Failed to fetch current Spotify user tracks');
      throw e;
    }
  }

  async getUser(id: string): Promise<SpotifyUser> {
    try {
      return await this.req.get<SpotifyUser>(`users/${id}`);
    } catch (e) {
      logger.warn(`Failed to fetch Spotify user: id: %s`, id);
      throw e;
    }
  }

  async getTrack(id: string): Promise<SpotifyTrack> {
    try {
      return await this.req.get<SpotifyTrack>(`tracks/${id}`);
    } catch (e) {
      logger.warn(`Failed to fetch Spotify track: id: %s`, id);
      throw e;
    }
  }

  async getPlaylist(id: string): Promise<SpotifyPlaylistTracks> {
    try {
      return await this.req.get<SpotifyPlaylistTracks>(`playlists/${id}`);
    } catch (e) {
      logger.warn(`Failed to fetch Spotify playlist: id: %s`, id);
      throw e;
    }
  }

  async getPlaylistTracks(
    id: string,
    progress?: ProgressUpdater,
    rangeFn?: RangeFactory,
  ): Promise<SpotifyPlaylistTracks> {
    try {
      const playlist = await this.getPlaylist(id);

      playlist.tracks.items = await this.getPaginatedItems(`playlists/${id}/tracks`, {
        initial: playlist.tracks,
        limit: 100,
        progress,
        rangeFn,
      });

      return playlist;
    } catch (e) {
      logger.warn(`Failed to fetch Spotify playlist tracks: id: %s`, id);
      throw e;
    }
  }

  async getAlbum(id: string): Promise<SpotifyAlbumFull> {
    try {
      return await this.req.get<SpotifyAlbumFull>(`albums/${id}`);
    } catch (e) {
      logger.warn(`Failed to fetch Spotify album: id: %s`, id);
      throw e;
    }
  }

  async getAlbumTracks(id: string): Promise<SpotifyAlbumFull> {
    try {
      const album = await this.getAlbum(id);
      album.tracks.items = await this.getPaginatedItems(`albums/${id}/tracks`, {
        initial: album.tracks,
      });
      return album;
    } catch (e) {
      logger.warn(`Failed to fetch Spotify album tracks: id: %s`, id);
      throw e;
    }
  }

  async getArtist(id: string): Promise<SpotifyArtist> {
    try {
      return await this.req.get<SpotifyArtist>(`artists/${id}`);
    } catch (e) {
      logger.warn(`Failed to fetch Spotify artist: id: %s`, id);
      throw e;
    }
  }

  async getArtistTracks(id: string): Promise<SpotifyTrack[]> {
    try {
      const response = await this.req.get<{ tracks: SpotifyTrack[] }>(`artists/${id}/top-tracks`, {
        country: 'US',
      });
      return response.tracks;
    } catch (e) {
      logger.warn(`Failed to fetch Spotify artist tracks: id: %s`, id);
      throw e;
    }
  }

  async searchPlaylists(query: string, limit = 5, userId?: string): Promise<SpotifyPlaylist[]> {
    if (userId) {
      return this.searchUserPlaylists(`users/${userId}`, query, limit);
    }

    try {
      const response = await this.req.get<{ playlists: SpotifyPagingObject<SpotifyPlaylist> }>(
        'search',
        { type: 'playlist', q: query, limit },
      );
      return response.playlists.items;
    } catch (e) {
      logger.warn(`Failed to search Spotify playlists: query: %s`, query);
      throw e;
    }
  }

  searchMyPlaylists(query: string, limit = 5): Promise<SpotifyPlaylist[]> {
    return this.searchUserPlaylists('me', query, limit);
  }

  private async searchUserPlaylists(
    resource: string,
    query: string,
    limit = 5,
  ): Promise<SpotifyPlaylist[]> {
    try {
      const playlists = await this.getPaginatedItems<SpotifyPlaylist>(`${resource}/playlists`);
      const results = await fuzzyMatch(
        query,
        playlists.map(playlist => playlist.name),
      );
      return results.slice(0, limit).map(result => playlists[result.key]);
    } catch (e) {
      logger.warn(
        `Failed to fetch Spotify user playlists: query: %s resource: %s`,
        query,
        resource,
      );
      throw e;
    }
  }

  async searchAlbums(query: string, limit = 5): Promise<SpotifyAlbum[]> {
    try {
      const response = await this.req.get<{ albums: SpotifyPagingObject<SpotifyAlbum> }>('search', {
        type: 'album',
        q: query,
        limit,
      });
      return response.albums.items;
    } catch (e) {
      logger.warn(`Failed to fetch Spotify album: query: %s`, query);
      throw e;
    }
  }

  async searchArtists(query: string, limit = 5): Promise<SpotifyArtist[]> {
    try {
      const response = await this.req.get<{ artists: SpotifyPagingObject<SpotifyArtist> }>(
        'search',
        {
          type: 'artist',
          q: query,
          limit,
        },
      );
      return response.artists.items;
    } catch (e) {
      logger.warn(`Failed to fetch Spotify artists: query: %s limit: %d`, query, limit);
      throw e;
    }
  }

  getStream(track: Track): Promise<StreamSource | undefined> {
    if (track.src !== TrackSource.Spotify) {
      throw new Error(
        `Tried to get spotify readable from non-spotify resource: ${JSON.stringify(track)}`,
      );
    }
    const trackCopy: Track = { ...track };

    // Spotify has a format like "Track name - modifier", Ex: "My Song - accoustic" or "My Song - remix"
    // YouTube its more common to do "My Song (accoustic)". So we map to this to improve odds of searching right thing
    const reg = /^\s*(?<title>.*[^\s])\s+-\s+(?<extra>[^-]+)\s*$/i;
    const match = reg.exec(trackCopy.title);
    if (match && match.groups) {
      const title = match.groups.title;
      const extra = match.groups.extra;

      // Remove 'remastered' as it often leads to flaky search results
      const noRemastered = extra.replace(/\s*remastered\s*/i, '');
      // @ts-ignore Irgnore readonly because we are creating a new object here
      trackCopy.title = noRemastered.length ? `${title} (${extra})` : title;
    }

    return this.youtube.searchStream(trackCopy);
  }

  private async getPaginatedItems<T>(path: string, options?: GetAllItemsOptions<T>): Promise<T[]> {
    const limit = options?.limit ?? 50;
    const params = options?.params ?? {};
    let data: SpotifyPagingObject<T> = options?.initial
      ? options.initial
      : await this.req.get(path, { limit, ...params });

    let offset = 0;
    let total = data.total;
    let items = data.items;

    if (options?.rangeFn) {
      const range = options.rangeFn(data.total);
      if (range) {
        offset = range.start;
        total = range.stop - range.start;
        items = items.slice(range.start, range.stop);
      }
    }

    if (total < 200 && options?.progress) {
      options.progress = undefined;
    }

    options?.progress?.init(total);

    while (items.length < total) {
      data = await this.req.get(path, { limit, offset: offset + items.length, ...params });
      items = items.concat(data.items);
      options?.progress?.update(items.length);
    }

    await options?.progress?.done();

    if (items.length > total) {
      items = items.slice(0, total);
    }

    return items;
  }
}

type GetAllItemsOptions<T> = {
  initial?: SpotifyPagingObject<T>;
  limit?: number;
  progress?: ProgressUpdater;
  rangeFn?: RangeFactory;
  params?: Record<string, string>;
};

export const spotify: ISpotifyApi = new SpotifyApi(youtube);

export function createSpotifyClient(request: IOAuthHttpClient): ISpotifyApi {
  return new SpotifyApi(youtube, request);
}
