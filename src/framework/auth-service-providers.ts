import { TrackSource } from '@eolian/api/@types';
import { createSoundCloudAuthService } from '@eolian/api/soundcloud';
import { createSpotifyAuthService } from '@eolian/api/spotify';
import { InMemoryCache } from '@eolian/data';
import { EolianCache } from '@eolian/data/@types';
import { AuthCacheItem, IAuthService } from '@eolian/http/@types';
import { IAuthServiceProvider, UserRequest } from './@types';

const AUTH_PROVIDER_CACHE_TTL = 1000 * 60 * 75;

class AuthServiceProvider implements IAuthServiceProvider {
  private readonly requestCache: EolianCache<UserRequest> = new InMemoryCache(
    AUTH_PROVIDER_CACHE_TTL,
    false,
  );

  constructor(
    private readonly authCallbackCache: EolianCache<AuthCacheItem>,
    private readonly spotify: IAuthService,
    private readonly soundcloud: IAuthService,
  ) {}

  getService(api: TrackSource): IAuthService {
    switch (api) {
      case TrackSource.Spotify:
        return this.spotify;
      case TrackSource.SoundCloud:
        return this.soundcloud;
      default:
        throw new Error(`Auth service not supported for: ${api}`);
    }
  }

  async getUserRequest(userId: string, api: TrackSource): Promise<UserRequest | undefined> {
    const key = `${api}_${userId}`;
    const req = await this.requestCache.get(key);
    await this.requestCache.refreshTTL(key);
    return req;
  }

  async setUserRequest(userId: string, request: UserRequest, api: TrackSource): Promise<void> {
    const key = `${api}_${userId}`;
    await this.requestCache.set(key, request);
  }

  async removeUserRequest(userId: string, api?: TrackSource): Promise<void> {
    if (api !== undefined) {
      const key = `${api}_${userId}`;
      await this.requestCache.del(key);
    } else {
      await this.removeUserRequest(userId, TrackSource.Spotify);
    }
  }

  async close(): Promise<void> {
    await Promise.allSettled([this.authCallbackCache.close(), this.requestCache.close()]);
  }
}

export function createAuthProviders(): IAuthServiceProvider {
  const cache = new InMemoryCache<AuthCacheItem>(60, false);
  const spotifyAuthService = createSpotifyAuthService(cache);
  const soundcloudAuthService = createSoundCloudAuthService(cache);
  return new AuthServiceProvider(cache, spotifyAuthService, soundcloudAuthService);
}
