import { ProgressUpdater } from '@eolian/common/@types';
import { StreamFetcher, RangeFactory } from '../@types';

export interface SpotifyUser {
  id: string;
  display_name?: string;
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
  tracks: {
    href: string;
    total: number;
    items?: SpotifyPlaylistTrack[];
  };
}

export interface SpotifyPlaylistTracks extends SpotifyPlaylist {
  tracks: SpotifyPagingObject<SpotifyPlaylistTrack>;
}

export interface SpotifyPlaylistTrack {
  track?: SpotifyTrack;
}

export interface SpotifyAlbum {
  id: string;
  external_urls: SpotifyExternalUrls;
  album_type: 'album' | 'single' | 'compilation';
  artists: SpotifyArtist[];
  images: SpotifyImageObject[];
  name: string;
  tracks?: {
    href: string;
    total: number;
    items?: SpotifyTrack[];
  };
}

export interface SpotifyAlbumFull extends SpotifyAlbum {
  tracks: SpotifyPagingObject<SpotifyTrack>;
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

export interface SpotifyImageObject {
  url: string;
  height?: number;
  width?: number;
}

export interface SpotifyTrack {
  id?: string;
  name: string;
  album: SpotifyAlbum;
  artists: SpotifyArtist[];
  is_local: boolean;
  duration_ms: number;
  uri: string;
  external_urls: SpotifyExternalUrls;
}

export type SpotifyUserTrack = {
  added_at: string;
  track: SpotifyTrack;
};

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
  ALBUM = 'album',
}

export const enum SpotifyTimeRange {
  SHORT = 'short_term',
  MEDIUM = 'medium_term',
  LONG = 'long_term',
}

export interface ISpotifyApi extends StreamFetcher {
  resolve(uri: string): SpotifyUrlDetails | undefined;
  getMe(): Promise<SpotifyUser>;
  getMyTracks(progress?: ProgressUpdater, rangeFn?: RangeFactory): Promise<SpotifyUserTrack[]>;
  getMyTopTracks(range?: SpotifyTimeRange): Promise<SpotifyTrack[]>;
  getUser(id: string): Promise<SpotifyUser>;
  getTrack(id: string): Promise<SpotifyTrack>;
  getPlaylist(id: string): Promise<SpotifyPlaylistTracks>;
  getPlaylistTracks(
    id: string,
    progress?: ProgressUpdater,
    rangeFn?: RangeFactory,
  ): Promise<SpotifyPlaylistTracks>;
  getAlbum(id: string): Promise<SpotifyAlbumFull>;
  getAlbumTracks(id: string): Promise<SpotifyAlbumFull>;
  getArtist(id: string): Promise<SpotifyArtist>;
  getArtistTracks(id: string): Promise<SpotifyTrack[]>;
  searchPlaylists(query: string, limit?: number, userId?: string): Promise<SpotifyPlaylist[]>;
  searchMyPlaylists(query: string, limit?: number): Promise<SpotifyPlaylist[]>;
  searchAlbums(query: string, limit?: number): Promise<SpotifyAlbum[]>;
  searchArtists(query: string, limit?: number): Promise<SpotifyArtist[]>;
}
