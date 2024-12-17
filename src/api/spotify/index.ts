import { Track, TrackSource } from '../@types';
import { SpotifyTrack } from './@types';

export * from './spotify-client';
export * from './spotify-request';

export function mapSpotifyTrack(
  track: SpotifyTrack,
  albumArtwork?: string,
  playlistArtwork?: string,
): Track {
  let artwork: string | undefined;
  if (track.is_local && playlistArtwork) {
    artwork = playlistArtwork;
  } else if (albumArtwork) {
    artwork = albumArtwork;
  } else if (track.album.images.length) {
    artwork = track.album.images[0].url;
  }
  return {
    id: track.id,
    poster: track.artists.map(artist => artist.name).join(', '),
    title: track.name,
    src: TrackSource.Spotify,
    url: track.external_urls.spotify,
    artwork,
    duration: track.duration_ms,
  };
}
