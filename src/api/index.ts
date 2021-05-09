import { SOURCE } from 'common/constants';
import { environment } from 'common/env';
import { StreamData, Track } from 'music/@types';
import { SoundCloudApi, SpotifyApi, YouTubeApi } from './@types';
import { SoundCloudApiImpl } from './soundcloud';
import { SpotifyApiImpl } from './spotify';
import { YouTubeApiImpl } from './youtube';

export const soundcloud: SoundCloudApi = new SoundCloudApiImpl(environment.tokens.soundcloud);
export const spotify: SpotifyApi = new SpotifyApiImpl(environment.tokens.spotify.clientId, environment.tokens.spotify.clientSecret);
export const youtube: YouTubeApi = new YouTubeApiImpl(environment.tokens.youtube);

export function getTrackStream(track: Track) : Promise<StreamData | undefined> {
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