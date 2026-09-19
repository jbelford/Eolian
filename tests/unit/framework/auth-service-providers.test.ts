import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackSource } from '@eolian/api/@types';

const mocks = vi.hoisted(() => {
  const cacheInstances: {
    ttl: number;
    clone: boolean;
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    refreshTTL: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  }[] = [];
  return {
    cacheInstances,
    spotify: { authorize: vi.fn(), callback: vi.fn() },
    soundcloud: { authorize: vi.fn(), callback: vi.fn() },
    createSpotifyAuthService: vi.fn(),
    createSoundCloudAuthService: vi.fn(),
  };
});

vi.mock('@eolian/data', () => ({
  InMemoryCache: class {
    get = vi.fn();
    set = vi.fn().mockResolvedValue(true);
    del = vi.fn().mockResolvedValue(true);
    refreshTTL = vi.fn().mockResolvedValue(true);
    close = vi.fn().mockResolvedValue(undefined);

    constructor(
      readonly ttl: number,
      readonly clone: boolean,
    ) {
      mocks.cacheInstances.push(this);
    }
  },
}));

vi.mock('@eolian/api/spotify', () => ({
  createSpotifyAuthService: mocks.createSpotifyAuthService,
}));

vi.mock('@eolian/api/soundcloud', () => ({
  createSoundCloudAuthService: mocks.createSoundCloudAuthService,
}));

import { createAuthProviders } from '@eolian/framework/auth-service-providers';

describe('auth service providers', () => {
  beforeEach(() => {
    mocks.cacheInstances.length = 0;
    mocks.createSpotifyAuthService.mockReset().mockReturnValue(mocks.spotify);
    mocks.createSoundCloudAuthService.mockReset().mockReturnValue(mocks.soundcloud);
  });

  it('creates both services with the callback cache and selects supported sources', () => {
    const provider = createAuthProviders();
    const callbackCache = mocks.cacheInstances[0];

    expect(callbackCache).toMatchObject({ ttl: 60, clone: false });
    expect(mocks.cacheInstances[1]).toMatchObject({ ttl: 75 * 60 * 1000, clone: false });
    expect(mocks.createSpotifyAuthService).toHaveBeenCalledWith(callbackCache);
    expect(mocks.createSoundCloudAuthService).toHaveBeenCalledWith(callbackCache);
    expect(provider.getService(TrackSource.Spotify)).toBe(mocks.spotify);
    expect(provider.getService(TrackSource.SoundCloud)).toBe(mocks.soundcloud);
    expect(() => provider.getService(TrackSource.YouTube)).toThrow(
      `Auth service not supported for: ${TrackSource.YouTube}`,
    );
  });

  it('keys requests by source and user and refreshes their TTL when read', async () => {
    const provider = createAuthProviders();
    const requestCache = mocks.cacheInstances[1];
    const request = { tokenProvider: {} };
    requestCache.get.mockResolvedValue(request);

    await provider.setUserRequest('user', request as never, TrackSource.SoundCloud);
    await expect(provider.getUserRequest('user', TrackSource.SoundCloud)).resolves.toBe(request);

    expect(requestCache.set).toHaveBeenCalledWith(`${TrackSource.SoundCloud}_user`, request);
    expect(requestCache.get).toHaveBeenCalledWith(`${TrackSource.SoundCloud}_user`);
    expect(requestCache.refreshTTL).toHaveBeenCalledWith(`${TrackSource.SoundCloud}_user`);
  });

  it('removes one source or every user request', async () => {
    const provider = createAuthProviders();
    const requestCache = mocks.cacheInstances[1];

    await provider.removeUserRequest('one', TrackSource.SoundCloud);
    expect(requestCache.del).toHaveBeenCalledWith(`${TrackSource.SoundCloud}_one`);

    requestCache.del.mockClear();
    await provider.removeUserRequest('all');
    expect(requestCache.del).toHaveBeenCalledTimes(2);
    expect(requestCache.del).toHaveBeenCalledWith(`${TrackSource.Spotify}_all`);
    expect(requestCache.del).toHaveBeenCalledWith(`${TrackSource.SoundCloud}_all`);
  });

  it('closes both caches even when one close fails', async () => {
    const provider = createAuthProviders();
    const [callbackCache, requestCache] = mocks.cacheInstances;
    callbackCache.close.mockRejectedValueOnce(new Error('close failed'));

    await expect(provider.close()).resolves.toBeUndefined();
    expect(callbackCache.close).toHaveBeenCalledOnce();
    expect(requestCache.close).toHaveBeenCalledOnce();
  });
});
