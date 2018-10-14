import * as querystring from 'querystring';
import * as request from 'request-promise-native';
import { EolianBotError } from '../common/errors';
import environment from "../environments/env";

export namespace SoundCloud {

  const API = 'https://api.soundcloud.com';

  export async function searchUser(query: string, limit = 5): Promise<SoundCloudUser[]> {
    try {
      const users: SoundCloudUser[] = await get('users', { q: query });
      return users.slice(0, limit);
    } catch (e) {
      throw new EolianBotError(e.stack ? e.stack : e, 'I failed to search SoundCloud');
    }
  }

  export async function resolveUser(url: string): Promise<SoundCloudUser> {
    try {
      const user: SoundCloudUser = await get('resolve', { url: url });
      if (!user.username) throw new EolianBotError('The url provided is not a SoundCloud user');
      return user;
    } catch (e) {
      throw new EolianBotError(e.stack ? e.stack : e, 'I failed to resolve the URL from SoundCloud');
    }
  }

  async function get(endpoint: string, params: any = {}) {
    params.client_id = environment.tokens.soundcloud;
    const data = await request(`${API}/${endpoint}?${querystring.stringify(params)}`)
    return JSON.parse(data);
  }

}