import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackSource } from '@eolian/api/@types';
import { FeatureFlag, ResourceType } from '@eolian/data/@types';
import { EolianUserError } from '@eolian/common/errors';

const { enabled } = vi.hoisted(() => ({ enabled: vi.fn() }));
vi.mock('@eolian/data', async importOriginal => {
  const actual = await importOriginal<typeof import('@eolian/data')>();
  return { ...actual, feature: { enabled } };
});
vi.mock('@eolian/api', () => ({
  youtube: {},
  spotify: {},
  soundcloud: {},
  poetry: {},
}));

import { getSourceFetcher, getSourceResolver, RESOURCE_TYPE_DETAILS } from '@eolian/resolvers';

function context(allowedYouTube = true) {
  return {
    server: { details: { isAllowedYouTube: allowedYouTube } },
    interaction: {
      send: vi.fn(),
      channel: {},
      user: {},
    },
  } as any;
}

describe('resolver factory', () => {
  beforeEach(() => enabled.mockReset().mockReturnValue(false));

  it.each([
    [TrackSource.SoundCloud, 'SoundCloudUrlResolver'],
    [TrackSource.YouTube, 'YouTubeUrlResolver'],
    [TrackSource.Spotify, 'SpotifyUrlResolver'],
    [TrackSource.Unknown, 'Object'],
  ])('routes URL source %s to %s', (source, constructorName) => {
    const resolver = getSourceResolver(context(), {
      URL: { source, value: 'https://example.test/resource' },
    } as never);
    expect(resolver.constructor.name).toBe(constructorName);
  });

  it('rejects URL combined with search or my', () => {
    expect(() =>
      getSourceResolver(context(), {
        URL: { source: TrackSource.YouTube, value: 'url' },
        SEARCH: 'query',
      } as never),
    ).toThrow('only an URL, SEARCH or MY');
  });

  it('uses deterministic keyword priority', () => {
    expect(
      getSourceResolver(context(), { ALBUM: true, PLAYLIST: true, SOUNDCLOUD: true } as never)
        .constructor.name,
    ).toBe('SpotifyAlbumResolver');
    expect(
      getSourceResolver(context(), { PLAYLIST: true, TRACKS: true } as never).constructor.name,
    ).toBe('YouTubePlaylistResolver');
    expect(getSourceResolver(context(), { AI: true, POEM: true } as never).constructor.name).toBe(
      'AiResolver',
    );
  });

  it('routes playlists based on ownership and explicit source', () => {
    expect(
      getSourceResolver(context(), { PLAYLIST: true, MY: true, SOUNDCLOUD: true } as never)
        .constructor.name,
    ).toBe('SoundCloudPlaylistResolver');
    expect(
      getSourceResolver(context(), { PLAYLIST: true, MY: true } as never).constructor.name,
    ).toBe('SpotifyPlaylistResolver');
    expect(
      getSourceResolver(context(), { PLAYLIST: true, SPOTIFY: true } as never).constructor.name,
    ).toBe('SpotifyPlaylistResolver');
  });

  it('falls back to SoundCloud when YouTube is unavailable', () => {
    expect(getSourceResolver(context(false), {} as never).constructor.name).toBe(
      'SoundCloudSongResolver',
    );
    expect(getSourceResolver(context(false), { PLAYLIST: true } as never).constructor.name).toBe(
      'SoundCloudPlaylistResolver',
    );
  });

  it('routes likes and tracks according to the Spotify auth flag', () => {
    enabled.mockImplementation(flag => flag === FeatureFlag.SPOTIFY_AUTH);
    expect(getSourceResolver(context(), { LIKES: true } as never).constructor.name).toBe(
      'SpotifyLikesResolver',
    );
    expect(
      getSourceResolver(context(), { TRACKS: true, SOUNDCLOUD: true } as never).constructor.name,
    ).toBe('SoundCloudTracksResolver');

    enabled.mockReturnValue(false);
    expect(
      getSourceResolver(context(), { TRACKS: true, SPOTIFY: true } as never).constructor.name,
    ).toBe('SoundCloudTracksResolver');
  });

  it('warns when requested source keywords cannot be honored', () => {
    const ctx = context();
    getSourceResolver(ctx, { SPOTIFY: true } as never);
    expect(ctx.interaction.send).toHaveBeenCalledWith(expect.stringContaining('YouTube instead'));

    getSourceResolver(ctx, { ALBUM: true, YOUTUBE: true } as never);
    expect(ctx.interaction.send).toHaveBeenCalledWith('I only support Spotify regarding albums.');
  });

  it('blocks non-SoundCloud resolvers and fetchers in restricted guilds', async () => {
    expect(() =>
      getSourceResolver(context(false), {
        URL: { source: TrackSource.YouTube, value: 'url' },
      } as never),
    ).toThrow(EolianUserError);

    await expect(
      getSourceFetcher(
        {
          src: TrackSource.Spotify,
          id: 'id',
          url: 'url',
          type: ResourceType.Song,
        },
        context(false),
        {} as never,
      ),
    ).rejects.toThrow('only use SoundCloud');
  });

  it('returns a deterministic unknown fetcher error', async () => {
    const fetcher = await getSourceFetcher(
      { src: TrackSource.Unknown, id: 'id', url: 'url', type: ResourceType.Song },
      context(),
      {} as never,
    );
    await expect(fetcher.fetch()).rejects.toThrow('Could not fetch unknown resource');
  });

  it('defines display names for every resource type', () => {
    expect(Object.values(RESOURCE_TYPE_DETAILS).map(details => details.name)).toEqual([
      'Playlist',
      'Album',
      'Likes',
      'Artist',
      'Song',
      'Tracks',
    ]);
  });
});
