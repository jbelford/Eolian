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

  it('rejects ambiguous and incorrectly typed resolved resources', async () => {
    get.mockResolvedValueOnce([{ kind: 'track' }]);
    await expect(client.resolve('url')).rejects.toBeInstanceOf(EolianUserError);

    get.mockResolvedValueOnce({ kind: 'track' });
    await expect(client.resolveUser('url')).rejects.toThrow('not a SoundCloud user');
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
