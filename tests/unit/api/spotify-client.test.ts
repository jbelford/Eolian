import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackSource } from '@eolian/api/@types';

const { searchStream, fuzzyMatch } = vi.hoisted(() => ({
  searchStream: vi.fn(),
  fuzzyMatch: vi.fn(),
}));
vi.mock('@eolian/api/youtube', () => ({ youtube: { searchStream } }));
vi.mock('@eolian/api/spotify/spotify-request', () => ({ CLIENT_SPOTIFY_REQUEST: {} }));
vi.mock('@eolian/common/util', async importOriginal => {
  const actual = await importOriginal<typeof import('@eolian/common/util')>();
  return { ...actual, fuzzyMatch };
});

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

  beforeEach(() => {
    get.mockReset();
    fuzzyMatch.mockReset();
  });

  it.each([
    ['https://open.spotify.com/track/abc?si=value', { type: 'track', id: 'abc' }],
    ['spotify:playlist:xyz', { type: 'playlist', id: 'xyz' }],
    ['https://example.test/not-spotify', undefined],
  ])('identifies Spotify resources in %s', (url, expected) => {
    expect(client.resolve(url)).toEqual(expected);
  });

  it('maps endpoint paths and search parameters', async () => {
    get
      .mockResolvedValueOnce({ id: 'me' })
      .mockResolvedValueOnce({ id: 'user' })
      .mockResolvedValueOnce(spotifyTrack('one'))
      .mockResolvedValueOnce({ id: 'artist' })
      .mockResolvedValueOnce({ playlists: { items: [{ id: 'p1' }] } })
      .mockResolvedValueOnce({ albums: { items: [{ id: 'album' }] } })
      .mockResolvedValueOnce({ artists: { items: [{ id: 'artist-result' }] } })
      .mockResolvedValueOnce({ tracks: [spotifyTrack('top')] });

    await client.getMe();
    await client.getUser('user');
    await client.getTrack('one');
    await client.getArtist('artist');
    await client.searchPlaylists('focus', 3);
    await client.searchAlbums('focus', 4);
    await client.searchArtists('focus', 2);
    await client.getArtistTracks('artist');

    expect(get.mock.calls).toEqual([
      ['me'],
      ['users/user'],
      ['tracks/one'],
      ['artists/artist'],
      ['search', { type: 'playlist', q: 'focus', limit: 3 }],
      ['search', { type: 'album', q: 'focus', limit: 4 }],
      ['search', { type: 'artist', q: 'focus', limit: 2 }],
      ['artists/artist/top-tracks', { country: 'US' }],
    ]);
  });

  it('paginates saved tracks with time-range parameters and progress', async () => {
    const progress = { init: vi.fn(), update: vi.fn(), done: vi.fn() };
    get
      .mockResolvedValueOnce({
        total: 201,
        items: Array.from({ length: 50 }, (_, index) => ({ track: spotifyTrack(String(index)) })),
      })
      .mockResolvedValueOnce({
        total: 201,
        items: Array.from({ length: 151 }, (_, index) => ({
          track: spotifyTrack(String(index + 50)),
        })),
      });

    const tracks = await client.getMyTracks(progress as never);

    expect(tracks).toHaveLength(201);
    expect(get.mock.calls).toEqual([
      ['me/tracks', { limit: 50 }],
      ['me/tracks', { limit: 50, offset: 50 }],
    ]);
    expect(progress.init).toHaveBeenCalledWith(201);
    expect(progress.update).toHaveBeenCalledWith(201);
    expect(progress.done).toHaveBeenCalledOnce();
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
    expect(get).toHaveBeenCalledWith('me/top/tracks', {
      limit: 50,
      time_range: 'medium_term',
    });
  });

  it('paginates album tracks and fuzzy-matches user playlists', async () => {
    const album = {
      id: 'album',
      tracks: { total: 3, items: [spotifyTrack('one')] },
    };
    get
      .mockResolvedValueOnce(album)
      .mockResolvedValueOnce({
        total: 3,
        items: [spotifyTrack('two'), spotifyTrack('three')],
      })
      .mockResolvedValueOnce({
        total: 2,
        items: [
          { id: 'first', name: 'Road Trip' },
          { id: 'second', name: 'Focus' },
        ],
      });
    fuzzyMatch.mockResolvedValue([{ key: 1, score: 100 }]);

    const result = await client.getAlbumTracks('album');
    await expect(client.searchMyPlaylists('focus', 1)).resolves.toEqual([
      { id: 'second', name: 'Focus' },
    ]);

    expect(result).toBe(album);
    expect(result.tracks.items.map(track => track.id)).toEqual(['one', 'two', 'three']);
    expect(get.mock.calls).toEqual([
      ['albums/album'],
      ['albums/album/tracks', { limit: 50, offset: 1 }],
      ['me/playlists', { limit: 50 }],
    ]);
    expect(fuzzyMatch).toHaveBeenCalledWith('focus', ['Road Trip', 'Focus']);
  });

  it('searches another user playlists and propagates API failures', async () => {
    get.mockResolvedValueOnce({
      total: 1,
      items: [{ id: 'playlist', name: 'Shared Mix' }],
    });
    fuzzyMatch.mockResolvedValue([{ key: 0, score: 100 }]);

    await expect(client.searchPlaylists('shared', 1, 'user-id')).resolves.toEqual([
      { id: 'playlist', name: 'Shared Mix' },
    ]);
    expect(get).toHaveBeenCalledWith('users/user-id/playlists', { limit: 50 });

    const error = new Error('Spotify unavailable');
    get.mockRejectedValueOnce(error);
    await expect(client.getMe()).rejects.toBe(error);
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
