import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackSource } from '@eolian/api/@types';

const { searchStream } = vi.hoisted(() => ({ searchStream: vi.fn() }));
vi.mock('@eolian/api/youtube', () => ({ youtube: { searchStream } }));
vi.mock('@eolian/api/spotify/spotify-request', () => ({ CLIENT_SPOTIFY_REQUEST: {} }));

import { createSpotifyClient } from '@eolian/api/spotify/spotify-client';

function spotifyTrack(id: string, name = `Track ${id}`) {
  return {
    id,
    name,
    artists: [{ name: 'Artist' }],
    album: { images: [{ url: 'art' }] },
    external_urls: { spotify: `https://spotify.test/${id}` },
    duration_ms: 123,
  };
}

describe('SpotifyApi', () => {
  const get = vi.fn();
  const client = createSpotifyClient({ get } as never);

  beforeEach(() => get.mockReset());

  it.each([
    ['https://open.spotify.com/track/abc?si=value', { type: 'track', id: 'abc' }],
    ['spotify:playlist:xyz', { type: 'playlist', id: 'xyz' }],
    ['https://example.test/not-spotify', undefined],
  ])('identifies Spotify resources in %s', (url, expected) => {
    expect(client.resolve(url)).toEqual(expected);
  });

  it('maps endpoint paths and search parameters', async () => {
    get
      .mockResolvedValueOnce(spotifyTrack('one'))
      .mockResolvedValueOnce({ playlists: { items: [{ id: 'p1' }] } })
      .mockResolvedValueOnce({ tracks: [spotifyTrack('top')] });

    await client.getTrack('one');
    await client.searchPlaylists('focus', 3);
    await client.getArtistTracks('artist');

    expect(get.mock.calls).toEqual([
      ['tracks/one'],
      ['search', { type: 'playlist', q: 'focus', limit: 3 }],
      ['artists/artist/top-tracks', { country: 'US' }],
    ]);
  });

  it('paginates playlist tracks, reports progress, and preserves the playlist', async () => {
    const progress = { init: vi.fn(), update: vi.fn(), done: vi.fn() };
    const playlist = {
      id: 'playlist',
      tracks: { total: 300, items: [{ track: spotifyTrack('one') }] },
    };
    get.mockResolvedValueOnce(playlist).mockResolvedValueOnce({
      total: 300,
      items: Array.from({ length: 299 }, (_, index) => ({
        track: spotifyTrack(String(index + 2)),
      })),
    });

    const result = await client.getPlaylistTracks('playlist', progress as never);

    expect(result).toBe(playlist);
    expect(result.tracks.items).toHaveLength(300);
    expect(get.mock.calls[1]).toEqual(['playlists/playlist/tracks', { limit: 100, offset: 1 }]);
    expect(progress.init).toHaveBeenCalledWith(300);
    expect(progress.update).toHaveBeenCalledWith(300);
    expect(progress.done).toHaveBeenCalledOnce();
  });

  it('applies a range while paginating top tracks', async () => {
    get
      .mockResolvedValueOnce({
        total: 10,
        items: [0, 1, 2, 3, 4].map(id => spotifyTrack(String(id))),
      })
      .mockResolvedValueOnce({
        total: 10,
        items: [5, 6].map(id => spotifyTrack(String(id))),
      });

    const tracks = await client.getMyTopTracks(undefined, undefined, () => ({ start: 2, stop: 5 }));

    expect(tracks.map(track => track.id)).toEqual(['2', '3', '4']);
    expect(get).toHaveBeenCalledOnce();
  });

  it('delegates Spotify streams to YouTube after normalizing title modifiers', async () => {
    searchStream.mockResolvedValue({ get: vi.fn() });
    const track = {
      id: 'id',
      title: 'Song - Remastered',
      poster: 'Artist',
      src: TrackSource.Spotify,
      url: 'url',
    };
    await client.getStream(track, { update: vi.fn() } as never);
    expect(searchStream).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Song', src: TrackSource.Spotify }),
      expect.anything(),
    );
    expect(track.title).toBe('Song - Remastered');
  });

  it('rejects stream requests for non-Spotify tracks', () => {
    expect(() =>
      client.getStream({
        title: 'Song',
        poster: 'Artist',
        src: TrackSource.SoundCloud,
        url: 'url',
      }),
    ).toThrow('non-spotify resource');
  });
});
