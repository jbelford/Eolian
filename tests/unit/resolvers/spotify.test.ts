import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackSource } from '@eolian/api/@types';
import { SpotifyResourceType, SpotifyTimeRange } from '@eolian/api/spotify/@types';
import { FeatureFlag, ResourceType } from '@eolian/data/@types';
import {
  makeContext,
  makeSpotifyAlbum,
  makeSpotifyArtist,
  makeSpotifyPlaylist,
  makeSpotifyTrack,
  makeSpotifyUser,
  selectionMessage,
} from './resolver-test-utils';

const mocks = vi.hoisted(() => {
  const authClient = {
    getMe: vi.fn(),
    getMyTracks: vi.fn(),
    getMyTopTracks: vi.fn(),
    searchMyPlaylists: vi.fn(),
    getPlaylist: vi.fn(),
    getPlaylistTracks: vi.fn(),
  };
  return {
    spotify: {
      searchAlbums: vi.fn(),
      getAlbumTracks: vi.fn(),
      searchArtists: vi.fn(),
      getArtistTracks: vi.fn(),
      searchPlaylists: vi.fn(),
      getPlaylistTracks: vi.fn(),
      resolve: vi.fn(),
      getAlbum: vi.fn(),
      getArtist: vi.fn(),
      getTrack: vi.fn(),
      getPlaylist: vi.fn(),
    },
    authClient,
    createSpotifyClient: vi.fn(),
    mapSpotifyTrack: vi.fn(),
    enabled: vi.fn(),
    getRangeOption: vi.fn(),
    progressInstances: [] as Array<{ sendable: unknown; name: string }>,
  };
});

vi.mock('@eolian/api', () => ({
  spotify: mocks.spotify,
  createSpotifyClient: mocks.createSpotifyClient,
  mapSpotifyTrack: mocks.mapSpotifyTrack,
}));
vi.mock('@eolian/data', async importOriginal => {
  const actual = await importOriginal<typeof import('@eolian/data')>();
  return { ...actual, feature: { enabled: mocks.enabled } };
});
vi.mock('@eolian/command-options', () => ({ getRangeOption: mocks.getRangeOption }));
vi.mock('@eolian/framework', () => ({
  DownloaderDisplay: class {
    constructor(sendable: unknown, name: string) {
      mocks.progressInstances.push({ sendable, name });
    }
  },
}));

import {
  SpotifyAlbumFetcher,
  SpotifyAlbumResolver,
} from '@eolian/resolvers/spotify/spotify-album-resolver';
import {
  SpotifyArtistFetcher,
  SpotifyArtistResolver,
} from '@eolian/resolvers/spotify/spotify-artist-resolver';
import {
  SpotifyLikesFetcher,
  SpotifyLikesResolver,
} from '@eolian/resolvers/spotify/spotify-likes-resolver';
import {
  SpotifyPlaylistFetcher,
  SpotifyPlaylistResolver,
} from '@eolian/resolvers/spotify/spotify-playlist-resolver';
import {
  SpotifyTracksFetcher,
  SpotifyTracksResolver,
} from '@eolian/resolvers/spotify/spotify-tracks-resolver';
import {
  SpotifySongFetcher,
  SpotifyUrlResolver,
} from '@eolian/resolvers/spotify/spotify-url-resolver';
import { getSpotifySourceFetcher } from '@eolian/resolvers/spotify';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockReturnValue(false);
  mocks.createSpotifyClient.mockReturnValue(mocks.authClient);
  mocks.mapSpotifyTrack.mockImplementation((track, artwork, fallback) => ({
    id: track.id,
    artwork,
    fallback,
    mapped: true,
  }));
  mocks.progressInstances.length = 0;
});

describe('Spotify album resolver and fetcher', () => {
  it('validates search, reports empty results, and honors FAST', async () => {
    await expect(new SpotifyAlbumResolver(makeContext(), {}).resolve()).rejects.toThrow(
      'Missing search query for album.',
    );
    mocks.spotify.searchAlbums.mockResolvedValue([]);
    await expect(
      new SpotifyAlbumResolver(makeContext(), { SEARCH: 'missing', FAST: true }).resolve(),
    ).rejects.toThrow('No Spotify albums were found.');
    expect(mocks.spotify.searchAlbums).toHaveBeenCalledWith('missing', 1);
  });

  it('resolves one album or the selected album and propagates cancellation', async () => {
    const albums = [makeSpotifyAlbum('one'), makeSpotifyAlbum('two')];
    mocks.spotify.searchAlbums.mockResolvedValueOnce([albums[0]]);
    const single = await new SpotifyAlbumResolver(makeContext(), { SEARCH: 'album' }).resolve();
    expect(single.identifier).toMatchObject({
      id: 'one',
      src: TrackSource.Spotify,
      type: ResourceType.Album,
    });

    const context = makeContext({ selected: 1 });
    mocks.spotify.searchAlbums.mockResolvedValueOnce(albums);
    const selected = await new SpotifyAlbumResolver(context, { SEARCH: 'album' }).resolve();
    expect(selected.identifier.id).toBe('two');
    expect(selected.selectionMessage).toBe(selectionMessage);
    expect(context.interaction.sendSelection).toHaveBeenCalledWith(
      'Select the album you want (resolved via Spotify)',
      albums.map(album => ({
        name: album.name,
        subname: album.artists.map((artist: any) => artist.name).join(','),
        url: album.external_urls.spotify,
      })),
      context.interaction.user,
    );

    mocks.spotify.searchAlbums.mockResolvedValue(albums);
    context.interaction.sendSelection.mockRejectedValue(new Error('selection cancelled'));
    await expect(new SpotifyAlbumResolver(context, { SEARCH: 'album' }).resolve()).rejects.toThrow(
      'selection cancelled',
    );
  });

  it('uses complete album tracks or reloads incomplete album data', async () => {
    const track = makeSpotifyTrack();
    const complete = makeSpotifyAlbum('album', {
      tracks: { href: '', total: 1, items: [track], limit: 50, next: '', offset: 0, previous: '' },
    });
    await expect(new SpotifyAlbumFetcher('album', complete).fetch()).resolves.toEqual({
      tracks: [
        {
          id: track.id,
          artwork: complete.images[0].url,
          fallback: undefined,
          mapped: true,
        },
      ],
    });
    expect(mocks.spotify.getAlbumTracks).not.toHaveBeenCalled();

    const full = makeSpotifyAlbum('album', {
      images: [],
      tracks: { href: '', total: 1, items: [track], limit: 50, next: '', offset: 0, previous: '' },
    });
    mocks.spotify.getAlbumTracks.mockResolvedValue(full);
    await new SpotifyAlbumFetcher(
      'album',
      makeSpotifyAlbum('album', { tracks: undefined }),
    ).fetch();
    expect(mocks.spotify.getAlbumTracks).toHaveBeenCalledWith('album');
    expect(mocks.mapSpotifyTrack).toHaveBeenLastCalledWith(track, undefined);
  });
});

describe('Spotify artist resolver and fetcher', () => {
  it('validates search, reports empty results, and honors FAST', async () => {
    await expect(new SpotifyArtistResolver(makeContext(), {}).resolve()).rejects.toThrow(
      'Missing search query for Spotify artist.',
    );
    mocks.spotify.searchArtists.mockResolvedValue([]);
    await expect(
      new SpotifyArtistResolver(makeContext(), { SEARCH: 'missing', FAST: true }).resolve(),
    ).rejects.toThrow('No Spotify artists were found.');
    expect(mocks.spotify.searchArtists).toHaveBeenCalledWith('missing', 1);
  });

  it('resolves one or selected artist and propagates cancellation', async () => {
    const artists = [makeSpotifyArtist('one'), makeSpotifyArtist('two')];
    mocks.spotify.searchArtists.mockResolvedValueOnce([artists[0]]);
    expect(
      (await new SpotifyArtistResolver(makeContext(), { SEARCH: 'artist' }).resolve()).identifier
        .id,
    ).toBe('one');

    const context = makeContext({ selected: 1 });
    mocks.spotify.searchArtists.mockResolvedValueOnce(artists);
    const selected = await new SpotifyArtistResolver(context, { SEARCH: 'artist' }).resolve();
    expect(selected.identifier.id).toBe('two');
    expect(selected.selectionMessage).toBe(selectionMessage);

    mocks.spotify.searchArtists.mockResolvedValue(artists);
    context.interaction.sendSelection.mockRejectedValue(new Error('selection cancelled'));
    await expect(
      new SpotifyArtistResolver(context, { SEARCH: 'artist' }).resolve(),
    ).rejects.toThrow('selection cancelled');
  });

  it('fetches and maps artist tracks', async () => {
    mocks.spotify.getArtistTracks.mockResolvedValue([
      makeSpotifyTrack('one'),
      makeSpotifyTrack('two'),
    ]);
    await expect(new SpotifyArtistFetcher('artist').fetch()).resolves.toEqual({
      tracks: [
        { id: 'one', artwork: undefined, fallback: undefined, mapped: true },
        { id: 'two', artwork: undefined, fallback: undefined, mapped: true },
      ],
    });
  });
});

describe('Spotify playlist resolver and fetcher', () => {
  it('requires search and reports empty public results', async () => {
    await expect(new SpotifyPlaylistResolver(makeContext(), {}).resolve()).rejects.toThrow(
      'You must specify a search query.',
    );
    mocks.spotify.searchPlaylists.mockResolvedValue([]);
    await expect(
      new SpotifyPlaylistResolver(makeContext(), { SEARCH: 'missing', FAST: true }).resolve(),
    ).rejects.toThrow('No Spotify playlists were found.');
    expect(mocks.spotify.searchPlaylists).toHaveBeenCalledWith('missing', 1);
  });

  it('searches MY playlists through saved identity or OAuth', async () => {
    const playlist = makeSpotifyPlaylist();
    const context = makeContext({
      user: { get: vi.fn().mockResolvedValue({ spotify: 'saved-user' }) },
    });
    mocks.spotify.searchPlaylists.mockResolvedValue([playlist]);
    await new SpotifyPlaylistResolver(context, { SEARCH: 'mine', MY: true }).resolve();
    expect(mocks.spotify.searchPlaylists).toHaveBeenCalledWith('mine', 5, 'saved-user');

    mocks.enabled.mockImplementation(flag => flag === FeatureFlag.SPOTIFY_AUTH);
    mocks.authClient.searchMyPlaylists.mockResolvedValue([playlist]);
    const authenticated = await new SpotifyPlaylistResolver(context, {
      SEARCH: 'mine',
      MY: true,
    }).resolve();
    expect(mocks.authClient.searchMyPlaylists).toHaveBeenCalledWith('mine', 5);
    expect(authenticated.identifier.auth).toBe(true);
  });

  it('reports a missing saved Spotify account', async () => {
    const context = makeContext({ user: { get: vi.fn().mockResolvedValue({}) } });
    await expect(
      new SpotifyPlaylistResolver(context, { SEARCH: 'mine', MY: true }).resolve(),
    ).rejects.toThrow("haven't set your Spotify account");
  });

  it('selects a playlist, preserves fallback author, and propagates cancellation', async () => {
    const playlists = [
      makeSpotifyPlaylist('one'),
      makeSpotifyPlaylist('two', { owner: makeSpotifyUser({ display_name: '' }) }),
    ];
    mocks.spotify.searchPlaylists.mockResolvedValue(playlists);
    const context = makeContext({ selected: 1 });
    const selected = await new SpotifyPlaylistResolver(context, { SEARCH: 'list' }).resolve();
    expect(selected.identifier.id).toBe('two');
    expect(selected.authors).toEqual(['<unknown>']);
    expect(selected.selectionMessage).toBe(selectionMessage);

    context.interaction.sendSelection.mockRejectedValue(new Error('selection cancelled'));
    await expect(
      new SpotifyPlaylistResolver(context, { SEARCH: 'list' }).resolve(),
    ).rejects.toThrow('selection cancelled');
  });

  it('uses complete embedded tracks and filters unavailable entries', async () => {
    const track = makeSpotifyTrack();
    const playlist = makeSpotifyPlaylist('playlist', {
      tracks: {
        href: '',
        total: 2,
        items: [{ track }, { track: undefined }],
        limit: 50,
        next: '',
        offset: 0,
        previous: '',
      },
    });
    const result = await new SpotifyPlaylistFetcher(
      playlist.id,
      {},
      makeContext().interaction.channel,
      mocks.spotify as never,
      playlist,
    ).fetch();
    expect(mocks.spotify.getPlaylistTracks).not.toHaveBeenCalled();
    expect(result).toEqual({
      tracks: [
        {
          id: track.id,
          artwork: undefined,
          fallback: playlist.images[0].url,
          mapped: true,
        },
      ],
      rangeOptimized: false,
    });

    const noArtwork = makeSpotifyPlaylist('plain', {
      images: [],
      tracks: {
        href: '',
        total: 1,
        items: [{ track }],
        limit: 50,
        next: '',
        offset: 0,
        previous: '',
      },
    });
    await new SpotifyPlaylistFetcher(
      noArtwork.id,
      {},
      makeContext().interaction.channel,
      mocks.spotify as never,
      noArtwork,
    ).fetch();
    expect(mocks.mapSpotifyTrack).toHaveBeenLastCalledWith(track, undefined, undefined);
  });

  it('reloads incomplete playlists while forwarding progress and range', async () => {
    const track = makeSpotifyTrack();
    const full = makeSpotifyPlaylist('playlist', {
      tracks: {
        href: '',
        total: 1,
        items: [{ track }],
        limit: 50,
        next: '',
        offset: 0,
        previous: '',
      },
    });
    mocks.spotify.getPlaylistTracks.mockResolvedValue(full);
    mocks.getRangeOption.mockReturnValue({ start: 2, stop: 5 });
    const context = makeContext();
    const params = { TOP: { start: 2, stop: 5 } } as never;
    const result = await new SpotifyPlaylistFetcher(
      'playlist',
      params,
      context.interaction.channel,
      mocks.spotify as never,
      makeSpotifyPlaylist('playlist', { tracks: { href: '', total: 1 } }),
    ).fetch();
    const [, progress, rangeFn] = mocks.spotify.getPlaylistTracks.mock.calls[0];
    expect(progress).toBeDefined();
    expect(rangeFn(10)).toEqual({ start: 2, stop: 5 });
    expect(mocks.getRangeOption).toHaveBeenCalledWith(params, 10);
    expect(mocks.progressInstances.at(-1)?.name).toBe('Fetching playlist tracks');
    expect(result.rangeOptimized).toBe(true);
  });
});

describe('Spotify likes and top tracks resolvers', () => {
  it('authenticates likes, builds identity metadata, and fetches with range support', async () => {
    const user = makeSpotifyUser({ display_name: undefined });
    const item = { track: makeSpotifyTrack() };
    mocks.authClient.getMe.mockResolvedValue(user);
    mocks.authClient.getMyTracks.mockResolvedValue([item]);
    mocks.getRangeOption.mockReturnValue({ start: 1, stop: 3 });
    const context = makeContext();
    const params = { TOP: { start: 1, stop: 3 } } as never;

    const resource = await new SpotifyLikesResolver(context, params).resolve();
    expect(resource).toMatchObject({
      name: 'Liked Tracks',
      authors: ['<unknown>'],
      identifier: { id: user.id, type: ResourceType.Likes, auth: true },
    });
    const result = await resource.fetcher.fetch();
    const [progress, rangeFn] = mocks.authClient.getMyTracks.mock.calls[0];
    expect(progress).toBeDefined();
    expect(rangeFn(9)).toEqual({ start: 1, stop: 3 });
    expect(result.rangeOptimized).toBe(true);
    expect(mocks.progressInstances.at(-1)?.name).toBe('Fetching Spotify likes');
  });

  it.each([
    [{ SHORT: true }, SpotifyTimeRange.SHORT, 'Last 4 Weeks'],
    [{ LONG: true }, SpotifyTimeRange.LONG, 'All Time'],
    [{}, undefined, 'Last 6 Months'],
  ])('forwards top-track time range %#', async (params, range, label) => {
    const user = makeSpotifyUser(range === undefined ? { display_name: undefined } : {});
    mocks.authClient.getMe.mockResolvedValue(user);
    mocks.authClient.getMyTopTracks.mockResolvedValue([makeSpotifyTrack()]);
    const context = makeContext();
    const resource = await new SpotifyTracksResolver(context, params).resolve();
    expect(resource.name).toBe(`Top Tracks (${label})`);
    expect(resource.authors).toEqual([range === undefined ? '<unknown>' : 'Spotify User']);
    expect(resource.identifier).toMatchObject({ type: ResourceType.Tracks, range, auth: true });
    await resource.fetcher.fetch();
    const [, progress, rangeFn] = mocks.authClient.getMyTopTracks.mock.calls[0];
    expect(progress).toBeDefined();
    rangeFn(25);
    expect(mocks.getRangeOption).toHaveBeenCalledWith(params, 25);
    expect(mocks.progressInstances.at(-1)?.name).toBe('Fetching Spotify top tracks');
  });
});

describe('Spotify URL resolver', () => {
  it('resolves album, artist, track, and playlist URLs', async () => {
    const context = makeContext();
    const cases = [
      [SpotifyResourceType.ALBUM, makeSpotifyAlbum(), mocks.spotify.getAlbum, ResourceType.Album],
      [
        SpotifyResourceType.ARTIST,
        makeSpotifyArtist(),
        mocks.spotify.getArtist,
        ResourceType.Artist,
      ],
      [SpotifyResourceType.TRACK, makeSpotifyTrack(), mocks.spotify.getTrack, ResourceType.Song],
      [
        SpotifyResourceType.PLAYLIST,
        makeSpotifyPlaylist(),
        mocks.spotify.getPlaylist,
        ResourceType.Playlist,
      ],
    ] as const;

    for (const [spotifyType, value, getter, resourceType] of cases) {
      mocks.spotify.resolve.mockReturnValue({ type: spotifyType, id: value.id });
      getter.mockResolvedValue(value);
      const resource = await new SpotifyUrlResolver('url', {}, context).resolve();
      expect(resource.identifier.type).toBe(resourceType);
      if (spotifyType === SpotifyResourceType.TRACK) {
        await resource.fetcher.fetch();
        expect(mocks.mapSpotifyTrack).toHaveBeenCalledWith(value);
      }
    }
  });

  it('uses an authenticated client for private playlist URLs', async () => {
    const playlist = makeSpotifyPlaylist('private');
    const context = makeContext({
      user: { get: vi.fn().mockResolvedValue({ tokens: { spotify: 'refresh-token' } }) },
    });
    mocks.enabled.mockReturnValue(true);
    mocks.spotify.resolve.mockReturnValue({ type: SpotifyResourceType.PLAYLIST, id: playlist.id });
    mocks.authClient.getPlaylist.mockResolvedValue(playlist);

    const resource = await new SpotifyUrlResolver('url', {}, context).resolve();

    expect(mocks.authClient.getPlaylist).toHaveBeenCalledWith(playlist.id);
    expect(resource.identifier.auth).toBe(true);
    expect(resource.fetcher).toMatchObject({ client: mocks.authClient });
  });

  it('keeps the public client when auth is enabled but the user has no Spotify token', async () => {
    const playlist = makeSpotifyPlaylist('public');
    const context = makeContext({ user: { get: vi.fn().mockResolvedValue({ tokens: {} }) } });
    mocks.enabled.mockReturnValue(true);
    mocks.spotify.resolve.mockReturnValue({ type: SpotifyResourceType.PLAYLIST, id: playlist.id });
    mocks.spotify.getPlaylist.mockResolvedValue(playlist);
    const resource = await new SpotifyUrlResolver('url', {}, context).resolve();
    expect(mocks.createSpotifyClient).not.toHaveBeenCalled();
    expect(resource.identifier.auth).toBe(false);
  });

  it('rejects local tracks, user URLs, malformed URLs, and propagates API errors', async () => {
    mocks.spotify.resolve.mockReturnValue({ type: SpotifyResourceType.TRACK, id: 'local' });
    mocks.spotify.getTrack.mockResolvedValue(makeSpotifyTrack('local', { is_local: true }));
    await expect(new SpotifyUrlResolver('url', {}, makeContext()).resolve()).rejects.toThrow(
      'Local Spotify tracks are not valid',
    );

    mocks.spotify.resolve.mockReturnValue({ type: SpotifyResourceType.USER, id: 'user' });
    await expect(new SpotifyUrlResolver('url', {}, makeContext()).resolve()).rejects.toThrow(
      'Spotify user URLs are not valid',
    );

    mocks.spotify.resolve.mockReturnValue(undefined);
    await expect(new SpotifyUrlResolver('bad', {}, makeContext()).resolve()).rejects.toThrow(
      'The Spotify URL is not valid!',
    );
    mocks.spotify.resolve.mockReturnValue({ type: 'episode', id: 'episode' });
    await expect(new SpotifyUrlResolver('bad', {}, makeContext()).resolve()).rejects.toThrow(
      'The Spotify URL is not valid!',
    );

    mocks.spotify.resolve.mockReturnValue({ type: SpotifyResourceType.ALBUM, id: 'album' });
    mocks.spotify.getAlbum.mockRejectedValue(new Error('Spotify unavailable'));
    await expect(new SpotifyUrlResolver('url', {}, makeContext()).resolve()).rejects.toThrow(
      'Spotify unavailable',
    );
  });

  it('fetches persisted songs by id', async () => {
    const track = makeSpotifyTrack();
    mocks.spotify.getTrack.mockResolvedValue(track);
    await expect(new SpotifySongFetcher(track.id).fetch()).resolves.toEqual({
      tracks: [{ id: track.id, artwork: undefined, fallback: undefined, mapped: true }],
    });
  });
});

describe('Spotify fetcher factory', () => {
  it.each([
    [ResourceType.Album, SpotifyAlbumFetcher],
    [ResourceType.Artist, SpotifyArtistFetcher],
    [ResourceType.Playlist, SpotifyPlaylistFetcher],
    [ResourceType.Song, SpotifySongFetcher],
  ])('restores public resource type %s', async (type, expected) => {
    const fetcher = await getSpotifySourceFetcher(
      { id: 'id', src: TrackSource.Spotify, type, url: 'url' },
      makeContext(),
      {},
    );
    expect(fetcher).toBeInstanceOf(expected);
  });

  it('restores authenticated likes and tracks including the saved time range', async () => {
    mocks.enabled.mockReturnValue(true);
    const context = makeContext();
    const likes = await getSpotifySourceFetcher(
      {
        id: 'user',
        src: TrackSource.Spotify,
        type: ResourceType.Likes,
        url: 'url',
        auth: true,
      },
      context,
      {},
    );
    expect(likes).toBeInstanceOf(SpotifyLikesFetcher);
    const tracks = await getSpotifySourceFetcher(
      {
        id: 'user',
        src: TrackSource.Spotify,
        type: ResourceType.Tracks,
        url: 'url',
        auth: true,
        range: SpotifyTimeRange.LONG,
      } as any,
      context,
      {},
    );
    expect(tracks).toBeInstanceOf(SpotifyTracksFetcher);
    expect(tracks).toMatchObject({ range: SpotifyTimeRange.LONG });
  });

  it('rejects auth-only types when auth is disabled and unknown types', async () => {
    const context = makeContext();
    await expect(
      getSpotifySourceFetcher(
        { id: 'id', src: TrackSource.Spotify, type: ResourceType.Likes, url: 'url' },
        context,
        {},
      ),
    ).rejects.toThrow('Invalid type for Spotify fetcher');
    await expect(
      getSpotifySourceFetcher(
        { id: 'id', src: TrackSource.Spotify, type: 99 as ResourceType, url: 'url' },
        context,
        {},
      ),
    ).rejects.toThrow('Invalid type for Spotify fetcher');
  });
});
