import { Color } from 'common/constants';
import { environment } from 'common/env';
import { InMemoryCache } from 'data';
import { OAuthRequest, StreamSource, Track, TrackSource, TrackSourceDetails } from './@types';
import { AuthCacheItem, AuthProviders } from './auth';
import { BingApiImpl } from './bing';
import { BingApi } from './bing/@types';
import { SoundCloudApiImpl } from './soundcloud';
import { SoundCloudApi } from './soundcloud/@types';
import { createSpotifyAuthService, SpotifyApiImpl } from './spotify';
import { SpotifyApi } from './spotify/@types';
import { YouTubeApiImpl } from './youtube';
import { YouTubeApi } from './youtube/@types';

let bing: BingApi | undefined;
if (environment.tokens.bing) {
  bing = new BingApiImpl(environment.tokens.bing.key, environment.tokens.bing.configId);
}
export const youtube: YouTubeApi = new YouTubeApiImpl(
  environment.tokens.youtube.token,
  environment.config.youtubeCacheLimit,
  bing
);
export const soundcloud: SoundCloudApi = new SoundCloudApiImpl(youtube);
export const spotify: SpotifyApi = new SpotifyApiImpl(youtube);

export * from './auth';
export {
  createSpotifyAuthorizationCodeProvider,
  createSpotifyRequest,
  mapSpotifyTrack,
} from './spotify';

export function createAuthProviders(): AuthProviders {
  const cache = new InMemoryCache<AuthCacheItem>(60, false);
  const spotifyAuthService = createSpotifyAuthService(cache);
  return new AuthProviders(cache, spotifyAuthService);
}

export function createSpotifyClient(request: OAuthRequest): SpotifyApi {
  return new SpotifyApiImpl(youtube, request);
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
