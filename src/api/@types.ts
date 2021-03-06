import { AbsRangeArgument, ProgressUpdater } from 'common/@types';
import { SOURCE } from 'common/constants';
import { Readable } from 'stream';

interface StreamFetcher {
  getStream(track: Track): Promise<StreamSource | undefined>;
}

export interface SoundCloudApi extends StreamFetcher {
  searchSongs(query: string, limit?: number): Promise<SoundCloudTrack[]>;
  searchUser(query: string, limit?: number): Promise<SoundCloudUser[]>;
  searchPlaylists(query: string, userId?: number): Promise<SoundCloudPlaylist[]>;
  resolve(url: string): Promise<SoundCloudResource>;
  resolveUser(url: string): Promise<SoundCloudUser>;
  getUser(id: number): Promise<SoundCloudUser>;
  getTrack(id: number): Promise<SoundCloudTrack>;
  getPlaylist(id: number): Promise<SoundCloudPlaylist>;
  getUserTracks(id: number): Promise<SoundCloudTrack[]>;
  getUserFavorites(id: number, max?: number, progress?: ProgressUpdater): Promise<SoundCloudTrack[]>;
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

export interface SpotifyApi extends StreamFetcher {
  resolve(uri: string): SpotifyUrlDetails | undefined
  getUser(id: string): Promise<SpotifyUser>;
  getTrack(id: string): Promise<SpotifyTrack>;
  getPlaylist(id: string): Promise<SpotifyPlaylistTracks>;
  getPlaylistTracks(id: string, progress?: ProgressUpdater, rangeFn?: RangeFactory): Promise<SpotifyPlaylistTracks>;
  getAlbum(id: string): Promise<SpotifyAlbumFull>;
  getAlbumTracks(id: string): Promise<SpotifyAlbumFull>;
  getArtist(id: string): Promise<SpotifyArtist>;
  getArtistTracks(id: string): Promise<SpotifyTrack[]>;
  searchPlaylists(query: string, userId?: string): Promise<SpotifyPlaylist[]>;
  searchAlbums(query: string): Promise<SpotifyAlbum[]>;
  searchArtists(query: string, limit?: number): Promise<SpotifyArtist[]>;
}

export type RangeFactory = (total: number) => AbsRangeArgument | undefined;

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
  }
}

export interface SpotifyPlaylistTracks extends SpotifyPlaylist {
  tracks: SpotifyPagingObject<SpotifyPlaylistTrack>;
}

export interface SpotifyPlaylistTrack {
  track?: SpotifyTrack
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
  }
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


export interface YouTubeApi extends StreamFetcher {
  getResourceType(url: string): YouTubeUrlDetails | undefined;
  getVideo(id: string): Promise<YoutubeVideo>;
  getPlaylist(id: string): Promise<YoutubePlaylist>;
  getPlaylistVideos(id: string): Promise<YoutubeVideo[]>;
  searchPlaylists(query: string): Promise<YoutubePlaylist[]>;
  searchVideos(query: string): Promise<YoutubeVideo[]>;
  searchStream(track: Track): Promise<StreamSource | undefined>;
}

export interface YouTubeUrlDetails {
  video?: string;
  playlist?: string;
}

export interface YoutubeVideo {
  id: string;
  channelName: string;
  name: string;
  url: string;
  artwork: string;
  isLive?: boolean;
}

export interface YoutubePlaylist {
  id: string;
  channelName: string;
  name: string;
  url: string;
  videos?: number;
}

export const enum YouTubeResourceType {
  VIDEO = 0,
  PLAYLIST
}

export interface Track {
  readonly id?: string;
  readonly title: string;
  readonly poster: string;
  readonly url: string;
  readonly stream?: string;
  readonly artwork?: string;
  readonly src: SOURCE;
  readonly duration?: number;
  readonly live?: boolean;
}

export interface StreamSource {
  get(seek?: number): Promise<Readable>;
}

export interface BingApi {
  searchVideos(query: string, publisher?: string, limit?: number): Promise<BingVideo[]>;
}

export interface BingVideoPublisher {
  name: string;
}

export interface BingVideo {
  id: string;
  name: string;
  duration: string;
  contentUrl: string;
  publisher: BingVideoPublisher[]
  creator: BingVideoPublisher
}