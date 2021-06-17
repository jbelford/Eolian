import { AbsRangeArgument, ProgressUpdater } from 'common/@types';
import { SOURCE } from 'common/constants';
import { logger } from 'common/logger';
import { fuzzyMatch } from 'common/util';
import requestPromise from 'request-promise-native';
import { RangeFactory, SpotifyAlbum, SpotifyAlbumFull, SpotifyApi, SpotifyArtist, SpotifyPagingObject, SpotifyPlaylist, SpotifyPlaylistTrack, SpotifyPlaylistTracks, SpotifyResourceType, SpotifyTrack, SpotifyUrlDetails, SpotifyUser, StreamData, Track, YouTubeApi } from './@types';

const enum SPOTIFY_API_VERSIONS {
  V1 = 'v1'
}

const SPOTIFY_API = 'https://api.spotify.com';
const SPOTIFY_TOKEN = 'https://accounts.spotify.com/api/token';


export class SpotifyApiImpl implements SpotifyApi {

  private expiration = 0;
  private accessToken?: string;

  constructor(private readonly clientId: string, private readonly clientSecret: string, private readonly youtube: YouTubeApi) {
  }

  resolve(uri: string): SpotifyUrlDetails | undefined {
    const matcher = /(spotify\.com\/|spotify:)(user|track|album|playlist|artist)[:/]([^?]+)/g
    const regArr = matcher.exec(uri);
    if (!regArr) return;
    return { type: regArr[2] as SpotifyResourceType, id: regArr[3] };
  }

  async getUser(id: string): Promise<SpotifyUser> {
    try {
      return await this.get<SpotifyUser>(`users/${id}`);
    } catch (e) {
      logger.warn(`Failed to fetch Spotify user: id: %s`, id);
      throw e;
    }
  }

  async getTrack(id: string): Promise<SpotifyTrack> {
    try {
      return await this.get<SpotifyTrack>(`tracks/${id}`);
    } catch (e) {
      logger.warn(`Failed to fetch Spotify track: id: %s`, id);
      throw e;
    }
  }

  async getPlaylist(id: string): Promise<SpotifyPlaylistTracks> {
    try {
      return await this.get<SpotifyPlaylistTracks>(`playlists/${id}`);
    } catch (e) {
      logger.warn(`Failed to fetch Spotify playlist: id: %s`, id);
      throw e;
    }
  }

  async getPlaylistTracks(id: string, progress?: ProgressUpdater, rangeFn?: RangeFactory): Promise<SpotifyPlaylistTracks> {
    try {
      const playlist = await this.getPlaylist(id);
      const options: GetAllItemsOptions<SpotifyPlaylistTrack> = { limit: 100 };

      let range: AbsRangeArgument | undefined;
      if (rangeFn) {
        range = rangeFn(playlist.tracks.total);
      }

      if (range) {
        options.offset = range.start;
        options.total = range.stop - range.start;
        playlist.tracks.items = playlist.tracks.items.slice(range.start, range.stop);
        if (playlist.tracks.items.length) {
          options.initial = playlist.tracks;
        }
      } else {
        options.initial = playlist.tracks;
        options.total = playlist.tracks.total;
      }

      if (options.total > 200) {
        options.progress = progress;
      }

      playlist.tracks.items = await this.getPaginatedItems(`playlists/${id}/tracks`, options);

      return playlist;
    } catch (e) {
      logger.warn(`Failed to fetch Spotify playlist tracks: id: %s`, id);
      throw e;
    }
  }

  async getAlbum(id: string): Promise<SpotifyAlbumFull> {
    try {
      return await this.get<SpotifyAlbumFull>(`albums/${id}`);
    } catch (e) {
      logger.warn(`Failed to fetch Spotify album: id: %s`, id);
      throw e;
    }
  }

  async getAlbumTracks(id: string): Promise<SpotifyAlbumFull> {
    try {
      const album = await this.getAlbum(id);
      album.tracks.items = await this.getPaginatedItems(`albums/${id}/tracks`, { initial: album.tracks });
      return album;
    } catch (e) {
      logger.warn(`Failed to fetch Spotify album tracks: id: %s`, id);
      throw e;
    }
  }

  async getArtist(id: string): Promise<SpotifyArtist> {
    try {
      return await this.get<SpotifyArtist>(`artists/${id}`);
    } catch (e) {
      logger.warn(`Failed to fetch Spotify artist: id: %s`, id);
      throw e;
    }
  }

  async getArtistTracks(id: string): Promise<SpotifyTrack[]> {
    try {
      const response = await this.get<{ tracks: SpotifyTrack[] }>(`artists/${id}/top-tracks`, { country: 'US' });
      return response.tracks;
    } catch (e) {
      logger.warn(`Failed to fetch Spotify artist tracks: id: %s`, id);
      throw e;
    }
  }

  async searchPlaylists(query: string, userId?: string): Promise<SpotifyPlaylist[]> {
    if (userId) {
      return this.searchUserPlaylists(query, userId);
    }

    try {
      const response = await this.get<{ playlists: SpotifyPagingObject<SpotifyPlaylist>}>('search',
        { type: 'playlist', q: query, limit: 5 });
      return response.playlists.items;
    } catch (e) {
      logger.warn(`Failed to search Spotify playlists: query: %s userId: %s`, query, userId);
      throw e;
    }
  }

  async searchAlbums(query: string): Promise<SpotifyAlbum[]> {
    try {
      const response = await this.get<{ albums: SpotifyPagingObject<SpotifyAlbum>}>('search',
        { type: 'album', q: query, limit: 5 });
      return response.albums.items;
    } catch (e) {
      logger.warn(`Failed to fetch Spotify album: query: %s`, query);
      throw e;
    }
  }

  async searchArtists(query: string, limit = 5): Promise<SpotifyArtist[]> {
    try {
      const response = await this.get<{ artists: SpotifyPagingObject<SpotifyArtist>}>('search',
        { type: 'artist', q: query, limit });
      return response.artists.items;
    } catch (e) {
      logger.warn(`Failed to fetch Spotify artists: query: %s limit: %d`, query, limit);
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
    const reg = /^\s*(?<title>.*[^\s])\s+-\s+(?<extra>[^-]+)\s*$/i;
    const match = reg.exec(trackCopy.title);
    if (match && match.groups) {
      const title = match.groups['title'];
      const extra = match.groups['extra'];

      // Remove 'remastered' as it often leads to flaky search results
      const noRemastered = extra.replace(/\s*remastered\s*/i, '');
      if (noRemastered.length) {
        trackCopy.title = `${title} (${extra})`;
      } else {
        trackCopy.title = title;
      }
    }

    return this.youtube.searchStream(trackCopy);
  }

  private async searchUserPlaylists(query: string, userId: string): Promise<SpotifyPlaylist[]> {
    try {
      const playlists = await this.getPaginatedItems<SpotifyPlaylist>(`users/${userId}/playlists`);
      const results = await fuzzyMatch(query, playlists.map(playlist => playlist.name));
      return results.slice(0, 5).map(result => playlists[result.key]);
    } catch (e) {
      logger.warn(`Failed to fetch Spotify user playlists: query: %s userId: %s`, query, userId);
      throw e;
    }
  }

  private async checkAndUpdateToken() {
    if (Date.now() + 10000 >= this.expiration) {
      const data = await this.getToken();
      this.accessToken = data.access_token;
      this.expiration = Date.now() + data.expires_in * 1000;
    }
  }

  private async getToken(): Promise<{ access_token: string, expires_in: number }> {
    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    logger.info(`Spotify HTTP: %s`, SPOTIFY_TOKEN);

    const resp = await requestPromise(SPOTIFY_TOKEN,
      { method: 'post', body: 'grant_type=client_credentials', json: true, headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' }});

    return resp;
  }

  private get<T>(path: string, params = {}, version = SPOTIFY_API_VERSIONS.V1) : Promise<T> {
    return this.getUrl(`${SPOTIFY_API}/${version}/${path}`, params);
  }

  private async getUrl<T>(url: string, params = {}) : Promise<T> {
    logger.info(`Spotify HTTP: %s - %s`, url, params);
    await this.checkAndUpdateToken();
    return await requestPromise(url, { qs: params, json: true, auth: { bearer: this.accessToken } }) as unknown as Promise<T>;
  }

  private async getPaginatedItems<T>(path: string, options?: GetAllItemsOptions<T>): Promise<T[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    let data: SpotifyPagingObject<T> = options?.initial ? options.initial : await this.get(path, { limit, offset });
    const total = options?.total ?? data.total;

    options?.progress?.init(total);

    let items = data.items;
    while (items.length < total) {
      data = await this.get(path, { limit, offset: offset + items.length });
      items = items.concat(data.items);
      options?.progress?.update(items.length);
    }

    await options?.progress?.done();

    if (options?.total && items.length > options.total) {
      items = items.slice(0, options.total);
    }

    return items;
  }

}

type GetAllItemsOptions<T> = {
  initial?: SpotifyPagingObject<T>;
  limit?: number;
  offset?: number;
  total?: number;
  progress?: ProgressUpdater;
};

export function mapSpotifyTrack(track: SpotifyTrack, albumArtwork?: string, playlistArtwork?: string): Track {
  let artwork: string | undefined;
  if (track.is_local && playlistArtwork) {
    artwork = playlistArtwork;
  } else if (albumArtwork) {
    artwork = albumArtwork;
  } else if (track.album.images.length) {
    artwork = track.album.images[0].url;
  }
  return {
    id: track.id,
    poster: track.artists.map(artist => artist.name).join(', '),
    title: track.name,
    src: SOURCE.SPOTIFY,
    url: track.external_urls.spotify,
    artwork,
    duration: track.duration_ms
  };
}
