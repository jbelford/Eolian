import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackSource } from '@eolian/api/@types';
import { EolianUserError } from '@eolian/common/errors';

const { searchStream } = vi.hoisted(() => ({ searchStream: vi.fn() }));
vi.mock('@eolian/api/youtube', () => ({ youtube: { searchStream } }));
vi.mock('@eolian/api/soundcloud/soundcloud-request', () => ({ CLIENT_SOUNDCLOUD_REQUEST: {} }));

import { createSoundCloudClient } from '@eolian/api/soundcloud/soundcloud-client';
import { SoundCloudStreamSource } from '@eolian/api/soundcloud/soundcloud-stream-source';

describe('SoundCloudApi', () => {
  const get = vi.fn();
  const getUri = vi.fn();
  const getStream = vi.fn();
  const request = { get, getUri, getStream };
  const client = createSoundCloudClient(request as never);

  beforeEach(() => {
    get.mockReset();
    getUri.mockReset();
    getStream.mockReset();
  });

  it('paginates and truncates owned search results', async () => {
    get.mockResolvedValue({
      collection: [{ id: 1 }],
      next_href: 'https://api.soundcloud.test/tracks?cursor=next',
    });
    const tracks = await client.searchSongs('query', 1);
    expect(tracks).toEqual([{ id: 1 }]);
    expect(get).toHaveBeenCalledWith('tracks', {
      access: 'playable,blocked,preview',
      q: 'query',
      linked_partitioning: true,
      limit: 1,
    });
    expect(getUri).not.toHaveBeenCalled();
  });

  it('follows next_href with original parameters and reports progress', async () => {
    const progress = { init: vi.fn(), update: vi.fn(), done: vi.fn() };
    get.mockResolvedValue({
      collection: [{ id: 1 }],
      next_href: 'https://api.soundcloud.test/likes?cursor=next',
    });
    getUri.mockResolvedValue({ collection: [{ id: 2 }], next_href: null });

    await expect(client.getMyFavorites(2, progress as never)).resolves.toEqual([
      { id: 1 },
      { id: 2 },
    ]);
    expect(getUri).toHaveBeenCalledWith(
      'https://api.soundcloud.test/likes?cursor=next&access=playable%2Cblocked%2Cpreview',
    );
    expect(progress.init).toHaveBeenCalledWith(2);
    expect(progress.update).toHaveBeenLastCalledWith(2);
    expect(progress.done).toHaveBeenCalledOnce();
  });

  it('maps current-user and resource endpoints', async () => {
    get
      .mockResolvedValueOnce({ id: 1, track_count: 2 })
      .mockResolvedValueOnce({ collection: [{ id: 10 }, { id: 11 }], next_href: null })
      .mockResolvedValueOnce({ id: 2 })
      .mockResolvedValueOnce({ id: 3 })
      .mockResolvedValueOnce({ id: 4 });

    await expect(client.getMyTracks()).resolves.toEqual([{ id: 10 }, { id: 11 }]);
    await client.getUser(2);
    await client.getTrack(3);
    await client.getPlaylist(4);

    expect(get.mock.calls).toEqual([
      ['me'],
      [
        'me/tracks',
        {
          access: 'playable,blocked,preview',
          linked_partitioning: true,
          limit: 2,
        },
      ],
      ['users/2'],
      ['tracks/3'],
      ['playlists/4', { access: 'playable,blocked,preview' }],
    ]);
  });

  it('uses the correct search paths for users, playlists, and owned playlists', async () => {
    get
      .mockResolvedValueOnce({ collection: [{ id: 1 }], next_href: null })
      .mockResolvedValueOnce({ collection: [{ id: 2 }], next_href: null })
      .mockResolvedValueOnce({ collection: [{ id: 3 }], next_href: null });

    await client.searchUser('artist', 2);
    await client.searchPlaylists('mix', 3, 42);
    await client.searchMyPlaylists('mine', 4);

    expect(get.mock.calls).toEqual([
      ['users', { q: 'artist', linked_partitioning: true, limit: 2 }],
      [
        'users/42/playlists',
        {
          access: 'playable,blocked,preview',
          q: 'mix',
          linked_partitioning: true,
          limit: 3,
        },
      ],
      [
        'me/playlists',
        {
          access: 'playable,blocked,preview',
          q: 'mine',
          linked_partitioning: true,
          limit: 4,
        },
      ],
    ]);
  });

  it('uses user counts for tracks and paginates user favorites', async () => {
    get
      .mockResolvedValueOnce({ id: 7, track_count: 1 })
      .mockResolvedValueOnce({ collection: [{ id: 1 }], next_href: null })
      .mockResolvedValueOnce({
        collection: [{ id: 2 }],
        next_href: 'https://api.soundcloud.test/likes?cursor=next',
      });
    getUri.mockResolvedValueOnce({ collection: [{ id: 3 }], next_href: null });

    await expect(client.getUserTracks(7)).resolves.toEqual([{ id: 1 }]);
    await expect(client.getUserFavorites(7, 2)).resolves.toEqual([{ id: 2 }, { id: 3 }]);

    expect(get.mock.calls[1][0]).toBe('users/7/tracks');
    expect(get.mock.calls[2][0]).toBe('users/7/likes/tracks');
  });

  it('rejects ambiguous and incorrectly typed resolved resources', async () => {
    get.mockResolvedValueOnce([{ kind: 'track' }]);
    await expect(client.resolve('url')).rejects.toBeInstanceOf(EolianUserError);

    get.mockResolvedValueOnce({ kind: 'track' });
    await expect(client.resolveUser('url')).rejects.toThrow('not a SoundCloud user');
  });

  it('returns resolved users and propagates API failures', async () => {
    const user = { id: 1, kind: 'user' };
    get.mockResolvedValueOnce(user);
    await expect(client.resolveUser('user-url')).resolves.toBe(user);

    const error = new Error('SoundCloud unavailable');
    get.mockRejectedValueOnce(error);
    await expect(client.getMe()).rejects.toBe(error);
  });

  it('uses YouTube for premium tracks and SoundCloud for playable tracks', async () => {
    const premium = {
      title: 'Premium',
      poster: 'Artist',
      src: TrackSource.SoundCloud,
      url: 'premium-url',
    };
    searchStream.mockResolvedValue('youtube-stream');
    await expect(client.getStream(premium)).resolves.toBe('youtube-stream');

    const playable = { ...premium, stream: 'transcoding-url' };
    const source = await client.getStream(playable);
    expect(source).toBeInstanceOf(SoundCloudStreamSource);
    getStream.mockResolvedValue('readable');
    await expect(source!.get()).resolves.toBe('readable');
    expect(getStream).toHaveBeenCalledWith('transcoding-url');
  });

  it('rejects stream requests for other sources', async () => {
    await expect(
      client.getStream({
        title: 'Song',
        poster: 'Artist',
        src: TrackSource.YouTube,
        url: 'url',
      }),
    ).rejects.toThrow('non-soundcloud resource');
  });
});
