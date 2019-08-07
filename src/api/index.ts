import { environment } from 'common/env';
import { CachedSoundCloudApi, SoundCloudApi } from './soundcloud';
import { CachedSpotifyApi, SpotifyApi } from './spotify';
import { CachedYouTubeApi, YouTubeApi } from './youtube';

export const soundcloud: SoundCloudApi = new CachedSoundCloudApi(environment.tokens.soundcloud, 1000 * 30);
export const spotify: SpotifyApi = new CachedSpotifyApi(environment.tokens.spotify.clientId, environment.tokens.spotify.clientSecret, 1000 * 30);
export const youtube: YouTubeApi = new CachedYouTubeApi(environment.tokens.youtube, 1000 * 30);