import { environment } from 'common/env';
import { SoundCloudApi, SoundCloudApiImpl } from './soundcloud';
import { SpotifyApi, SpotifyApiImpl } from './spotify';
import { YouTubeApi, YouTubeApiImpl } from './youtube';

export const soundcloud: SoundCloudApi = new SoundCloudApiImpl(environment.tokens.soundcloud);
export const spotify: SpotifyApi = new SpotifyApiImpl(environment.tokens.spotify.clientId, environment.tokens.spotify.clientSecret);
export const youtube: YouTubeApi = new YouTubeApiImpl(environment.tokens.youtube);