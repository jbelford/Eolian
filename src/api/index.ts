import { Color } from '@eolian/common/constants';
import { AuthorizationCodeProvider } from '@eolian/http';
import { IOAuthHttpClient, IAuthorizationProvider } from '@eolian/http/@types';
import { TrackSource, Track, StreamSource, TrackSourceDetails } from './@types';
import {
  createSoundCloudAuthorizationCodeProvider,
  createSoundCloudRequest,
  soundcloud,
} from './soundcloud';
import { createSpotifyAuthorizationCodeProvider, createSpotifyRequest, spotify } from './spotify';
import { youtube } from './youtube';

export * from './bing';
export * from './soundcloud';
export * from './spotify';
export * from './youtube';

export function createAuthCodeRequest(
  provider: IAuthorizationProvider,
  api: TrackSource,
  refreshToken?: string
): IOAuthHttpClient<AuthorizationCodeProvider> {
  switch (api) {
    case TrackSource.Spotify: {
      const tokenProvider = createSpotifyAuthorizationCodeProvider(provider, refreshToken);
      return createSpotifyRequest(tokenProvider);
    }
    case TrackSource.SoundCloud: {
      const tokenProvider = createSoundCloudAuthorizationCodeProvider(provider, refreshToken);
      return createSoundCloudRequest(tokenProvider);
    }
    default:
      throw new Error(`Auth Code not supported for ${api}`);
  }
}

export function getTrackStream(track: Track): Promise<StreamSource | undefined> {
  switch (track.src) {
    case TrackSource.SoundCloud:
      return soundcloud.getStream(track);
    case TrackSource.YouTube:
      return youtube.getStream(track);
    case TrackSource.Spotify:
      return spotify.getStream(track);
    default:
      throw new Error('Attempted to fetch stream for unknown source');
  }
}

export const SOURCE_DETAILS: Record<TrackSource, TrackSourceDetails> = {
  [TrackSource.SoundCloud]: {
    name: 'SoundCloud',
    color: Color.SoundCloud,
    icon: 'https://www.dropbox.com/s/ub1jhziixrc00da/soundcloud_icon.png?raw=1',
  },
  [TrackSource.Spotify]: {
    name: 'Spotify',
    color: Color.Spotify,
    icon: 'https://www.dropbox.com/s/l1q0wrz2a5w0i64/spotify_icon.png?raw=1',
  },
  [TrackSource.YouTube]: {
    name: 'YouTube',
    color: Color.YouTube,
    icon: 'https://www.dropbox.com/s/m6dwdgwwf06d67g/youtube_icon.png?raw=1',
  },
  [TrackSource.Unknown]: {
    name: 'Unknown',
    color: Color.YouTube,
  },
};
