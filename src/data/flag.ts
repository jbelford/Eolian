import { environment } from 'common/env';
import { FeatureFlag, FeatureFlagService } from './@types';

const flagsLocal: Record<FeatureFlag, boolean> = {
  [FeatureFlag.SPOTIFY_AUTH]: environment.flags.spotifyUserAuth,
  [FeatureFlag.SOUNDCLOUD_AUTH]: environment.flags.soundcloudUserAuth,
  [FeatureFlag.DISCORD_OLD_LEAVE]: environment.flags.discordOldLeave,
};

class SimpleFeatureFlagService implements FeatureFlagService {

  enabled(flag: FeatureFlag): boolean {
    return flagsLocal[flag];
  }

}

export const feature: FeatureFlagService = new SimpleFeatureFlagService();