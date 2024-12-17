import { ProgressUpdater } from '@eolian/common/@types';
import { StreamFetcher } from '../@types';

export interface ISoundCloudApi extends StreamFetcher {
  getMe(): Promise<SoundCloudUser>;
  getMyTracks(): Promise<SoundCloudTrack[]>;
  getMyFavorites(max?: number, progress?: ProgressUpdater): Promise<SoundCloudTrack[]>;
  searchMyPlaylists(query: string, limit?: number): Promise<SoundCloudPlaylist[]>;
  searchSongs(query: string, limit?: number): Promise<SoundCloudTrack[]>;
  searchUser(query: string, limit?: number): Promise<SoundCloudUser[]>;
  searchPlaylists(query: string, limit?: number, userId?: number): Promise<SoundCloudPlaylist[]>;
  resolve(url: string): Promise<SoundCloudResource>;
  resolveUser(url: string): Promise<SoundCloudUser>;
  getUser(id: number): Promise<SoundCloudUser>;
  getTrack(id: number): Promise<SoundCloudTrack>;
  getPlaylist(id: number): Promise<SoundCloudPlaylist>;
  getUserTracks(id: number): Promise<SoundCloudTrack[]>;
  getUserFavorites(
    id: number,
    max?: number,
    progress?: ProgressUpdater,
  ): Promise<SoundCloudTrack[]>;
}

export type SoundCloudFavoritesCallback = (count: number) => Promise<void>;

export const enum SoundCloudResourceType {
  USER = 'user',
  PLAYLIST = 'playlist',
  TRACK = 'track',
}

export interface SoundCloudResource {
  id: number;
  kind: SoundCloudResourceType;
  permalink_url: string;
}

export interface SoundCloudUser extends SoundCloudResource {
  username: string;
  avatar_url: string;
  public_favorites_count: number;
  followers_count: number;
  track_count: number;
}

export interface SoundCloudPlaylist extends SoundCloudResource {
  artwork_url: string;
  tracks: SoundCloudTrack[];
  track_count: number;
  title: string;
  user: SoundCloudUser;
}

export interface SoundCloudTrack extends SoundCloudResource {
  access: 'playable' | 'preview' | 'blocked';
  streamable: boolean;
  duration: number;
  stream_url: string;
  artwork_url: string;
  user: SoundCloudUser;
  title: string;
}

export interface SoundCloudPaginatedResult<T> {
  collection: T[];
  next_href: string;
}
