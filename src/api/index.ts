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
import { poetry } from './poetry';
import { AiStreamSource } from './speech';

export * from './bing';
export * from './soundcloud';
export * from './spotify';
export * from './youtube';
export * from './poetry';

export function createAuthCodeRequest(
  provider: IAuthorizationProvider,
  api: TrackSource,
  refreshToken?: string,
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
    case TrackSource.Poetry:
      return poetry.getStream(track);
    case TrackSource.AI:
      return Promise.resolve(new AiStreamSource(track));
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
  [TrackSource.Poetry]: {
    name: 'Poetry',
    color: Color.Spotify,
    icon: 'https://www.dropbox.com/scl/fi/kcdit2k2rqmk2eaymcrcb/poetry_icon.png?rlkey=96dolxro85c4lhspte3ws6keu&st=4u1g80e2&raw=1',
  },
  [TrackSource.AI]: {
    name: 'AI',
    color: Color.AI,
  },
  [TrackSource.Unknown]: {
    name: 'Unknown',
    color: Color.YouTube,
  },
};
