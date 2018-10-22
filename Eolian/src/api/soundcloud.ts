import { EolianBotError } from 'common/errors';
import environment from "environments/env";
import * as querystring from 'querystring';
import * as request from 'request-promise-native';

export namespace SoundCloud {

  const API = 'https://api.soundcloud.com';

  export async function searchUser(query: string, limit = 5): Promise<SoundCloudUser[]> {
    try {
      const users: SoundCloudUser[] = await get('users', { q: query });
      return users.slice(0, limit);
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'I failed to search SoundCloud');
    }
  }

  export async function resolveUser(url: string): Promise<SoundCloudUser> {
    try {
      const resource: SoundCloudResource = await get('resolve', { url: url });
      if (resource.kind !== 'user') throw new EolianBotError('The url provided is not a SoundCloud user');
      return resource as SoundCloudUser;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'I failed to resolve the URL from SoundCloud');
    }
  }

  export async function resolvePlaylist(url: string): Promise<SoundCloudPlaylist> {
    try {
      const resource: SoundCloudResource = await get('resolve', { url: url, representation: 'compact' });
      if (resource.kind !== 'playlist') throw new EolianBotError('The url provided is not a SoundCloud playlist');
      return resource as SoundCloudPlaylist;
    } catch (e) {
      throw new EolianBotError(e.stack || e, 'I failed to resolve the URL from SoundCloud');
    }
  }

  export async function searchPlaylists(query: string, userId?: number): Promise<SoundCloudPlaylist[]> {
    try {
      const playlists: SoundCloudPlaylist[] = await get(userId ? `users/${userId}/playlists` : 'playlists',
        { q: query, representation: 'compact' });
      return playlists.slice(0, 5);
    } catch (e) {
      throw new EolianBotError(e.stack || e, `Failed to search SoundCloud playlists.`);
    }
  }

  export async function getUser(id: number): Promise<SoundCloudUser> {
    try {
      const user: SoundCloudUser = await get(`users/${id}`);
      return user;
    } catch (e) {
      throw new EolianBotError(e.stack || e, `Failed to fetch SoundCloud user profile.`);
    }
  }

  async function get(endpoint: string, params: any = {}) {
    params.client_id = environment.tokens.soundcloud;
    const data = await request(`${API}/${endpoint}?${querystring.stringify(params)}`);
    return JSON.parse(data);
  }

}