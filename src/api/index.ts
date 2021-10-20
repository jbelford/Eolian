import { SOURCE } from 'common/constants';
import { environment } from 'common/env';
import { BingApi, SoundCloudApi, SpotifyApi, StreamSource, Track, YouTubeApi } from './@types';
import { BingApiImpl } from './bing';
import { SoundCloudApiImpl } from './soundcloud';
import { SpotifyApiImpl } from './spotify';
import { YouTubeApiImpl } from './youtube';

const bing: BingApi = new BingApiImpl(environment.tokens.bing.key, environment.tokens.bing.configId);
export const youtube: YouTubeApi = new YouTubeApiImpl(environment.tokens.youtube.token, environment.tokens.youtube.cookie, environment.youtubeCacheLimit, bing);
export const soundcloud: SoundCloudApi = new SoundCloudApiImpl(environment.tokens.soundcloud.clientId, environment.tokens.soundcloud.clientSecret, youtube);
export const spotify: SpotifyApi = new SpotifyApiImpl(environment.tokens.spotify.clientId, environment.tokens.spotify.clientSecret, youtube);

export function getTrackStream(track: Track) : Promise<StreamSource | undefined> {
  switch (track.src) {
    case SOURCE.SOUNDCLOUD:
      return soundcloud.getStream(track);
    case SOURCE.YOUTUBE:
      return youtube.getStream(track);
    case SOURCE.SPOTIFY:
      return spotify.getStream(track);
    default:
      throw new Error('Attempted to fetch stream for unknown source');
  }
}