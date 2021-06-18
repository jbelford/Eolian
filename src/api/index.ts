import { SOURCE } from 'common/constants';
import { environment } from 'common/env';
import { BingApi, SoundCloudApi, SpotifyApi, StreamData, Track, YouTubeApi } from './@types';
import { BingApiImpl } from './bing';
import { SoundCloudApiImpl } from './soundcloud';
import { SpotifyApiImpl } from './spotify';
import { YouTubeApiImpl } from './youtube';

const bing: BingApi = new BingApiImpl(environment.tokens.bing.key, environment.tokens.bing.configId);
export const youtube: YouTubeApi = new YouTubeApiImpl(environment.tokens.youtube, bing);
export const soundcloud: SoundCloudApi = new SoundCloudApiImpl(environment.tokens.soundcloud, youtube);
export const spotify: SpotifyApi = new SpotifyApiImpl(environment.tokens.spotify.clientId, environment.tokens.spotify.clientSecret, youtube);

export function getTrackStream(track: Track, seek?: number) : Promise<StreamData | undefined> {
  switch (track.src) {
    case SOURCE.SOUNDCLOUD:
      return soundcloud.getStream(track);
    case SOURCE.YOUTUBE:
      return youtube.getStream(track, seek);
    case SOURCE.SPOTIFY:
      return spotify.getStream(track);
    default:
      throw new Error('Attempted to fetch stream for unknown source');
  }
}