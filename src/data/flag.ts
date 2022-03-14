import { environment } from 'common/env';
import { FeatureFlag, FeatureFlagService } from './@types';

const flagsLocal: Record<FeatureFlag, boolean> = {
  [FeatureFlag.SPOTIFY_AUTH]: environment.flags.spotifyUserAuth,
  [FeatureFlag.DISCORD_OLD_LEAVE]: environment.flags.discordOldLeave,
};

class FeatureFlagServiceImpl implements FeatureFlagService {

  enabled(flag: FeatureFlag): boolean {
    return flagsLocal[flag];
  }

}

export const feature: FeatureFlagService = new FeatureFlagServiceImpl();
