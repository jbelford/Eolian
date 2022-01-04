import { Color } from 'common/constants';
import { environment } from 'common/env';
import {
  BingApi,
  SoundCloudApi,
  SpotifyApi,
  StreamSource,
  Track,
  TrackSource,
  TrackSourceDetails,
  YouTubeApi,
} from './@types';
import { BingApiImpl } from './bing';
import { SoundCloudApiImpl } from './soundcloud';
import { SpotifyApiImpl } from './spotify';
import { YouTubeApiImpl } from './youtube';

let bing: BingApi | undefined;
if (environment.tokens.bing) {
  bing = new BingApiImpl(environment.tokens.bing.key, environment.tokens.bing.configId);
}
export const youtube: YouTubeApi = new YouTubeApiImpl(
  environment.tokens.youtube.token,
  environment.youtubeCacheLimit,
  bing
);
export const soundcloud: SoundCloudApi = new SoundCloudApiImpl(
  environment.tokens.soundcloud.clientId,
  environment.tokens.soundcloud.clientSecret,
  youtube
);
export const spotify: SpotifyApi = new SpotifyApiImpl(
  environment.tokens.spotify.clientId,
  environment.tokens.spotify.clientSecret,
  youtube
);

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
