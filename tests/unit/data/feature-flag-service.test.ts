import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureFlag } from '@eolian/data/@types';

describe('feature flag service', () => {
  beforeEach(() => vi.resetModules());

  it('reflects the configured environment flags', async () => {
    vi.doMock('@eolian/common/env', () => ({
      environment: {
        flags: {
          spotifyUserAuth: true,
          soundcloudUserAuth: false,
          discordOldLeave: true,
          enableWebsite: false,
        },
      },
    }));

    const { feature } = await import('@eolian/data/feature-flag-service');

    expect(feature.enabled(FeatureFlag.SPOTIFY_AUTH)).toBe(true);
    expect(feature.enabled(FeatureFlag.SOUNDCLOUD_AUTH)).toBe(false);
    expect(feature.enabled(FeatureFlag.DISCORD_OLD_LEAVE)).toBe(true);
    expect(feature.enabled(FeatureFlag.WEBSITE)).toBe(false);
  });

  it('takes a stable snapshot when the service module is initialized', async () => {
    const environment = {
      flags: {
        spotifyUserAuth: false,
        soundcloudUserAuth: false,
        discordOldLeave: false,
        enableWebsite: false,
      },
    };
    vi.doMock('@eolian/common/env', () => ({ environment }));
    const { feature } = await import('@eolian/data/feature-flag-service');

    environment.flags.spotifyUserAuth = true;

    expect(feature.enabled(FeatureFlag.SPOTIFY_AUTH)).toBe(false);
  });
});
