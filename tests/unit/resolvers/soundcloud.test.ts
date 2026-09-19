import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackSource } from '@eolian/api/@types';
import { SoundCloudResourceType } from '@eolian/api/soundcloud/@types';
import { FeatureFlag, ResourceType } from '@eolian/data/@types';
import {
  makeContext,
  makeSoundCloudPlaylist,
  makeSoundCloudTrack,
  makeSoundCloudUser,
  selectionMessage,
} from './resolver-test-utils';

const mocks = vi.hoisted(() => {
  const makeClient = () => ({
    getMe: vi.fn(),
    getMyTracks: vi.fn(),
    getMyFavorites: vi.fn(),
    searchMyPlaylists: vi.fn(),
    getPlaylist: vi.fn(),
  });
  return {
    soundcloud: {
      searchUser: vi.fn(),
      getUser: vi.fn(),
      getUserTracks: vi.fn(),
      searchSongs: vi.fn(),
      getTrack: vi.fn(),
      searchPlaylists: vi.fn(),
      getPlaylist: vi.fn(),
      getUserFavorites: vi.fn(),
      resolve: vi.fn(),
    },
    authClient: makeClient(),
    createSoundCloudClient: vi.fn(),
    mapSoundCloudTrack: vi.fn(),
    enabled: vi.fn(),
    getRangeOption: vi.fn(),
    progressInstances: [] as Array<{ sendable: unknown; name: string }>,
  };
});

vi.mock('@eolian/api', () => ({
  soundcloud: mocks.soundcloud,
  createSoundCloudClient: mocks.createSoundCloudClient,
  mapSoundCloudTrack: mocks.mapSoundCloudTrack,
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
  createSoundCloudUser,
  SoundCloudArtistFetcher,
  SoundCloudArtistResolver,
  SoundCloudTracksResolver,
} from '@eolian/resolvers/soundcloud/soundcloud-artist-resolver';
import {
  SoundCloudFavoritesFetcher,
  SoundCloudFavoritesResolver,
} from '@eolian/resolvers/soundcloud/soundcloud-likes-resolver';
import {
  SoundCloudPlaylistFetcher,
  SoundCloudPlaylistResolver,
} from '@eolian/resolvers/soundcloud/soundcloud-playlist-resolver';
import {
  SoundCloudSongFetcher,
  SoundCloudSongResolver,
} from '@eolian/resolvers/soundcloud/soundcloud-song-resolver';
import { SoundCloudUrlResolver } from '@eolian/resolvers/soundcloud/soundcloud-url-resolver';
import { getSoundCloudSourceFetcher } from '@eolian/resolvers/soundcloud';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled.mockReturnValue(false);
  mocks.createSoundCloudClient.mockReturnValue(mocks.authClient);
  mocks.mapSoundCloudTrack.mockImplementation(track => ({ id: track.id, mapped: true }));
  mocks.progressInstances.length = 0;
});

describe('SoundCloud artist and tracks resolvers', () => {
  it('validates queries, reports empty search results, and honors FAST', async () => {
    await expect(new SoundCloudArtistResolver(makeContext(), {}).resolve()).rejects.toThrow(
      'Missing query for SoundCloud artist.',
    );
    mocks.soundcloud.searchUser.mockResolvedValue([]);
    await expect(
      new SoundCloudArtistResolver(makeContext(), { SEARCH: 'missing', FAST: true }).resolve(),
    ).rejects.toThrow('No SoundCloud users were found.');
    expect(mocks.soundcloud.searchUser).toHaveBeenCalledWith('missing', 1);
  });

  it('resolves one artist or the selected artist', async () => {
    const users = [makeSoundCloudUser(1), makeSoundCloudUser(2)];
    const singleContext = makeContext();
    mocks.soundcloud.searchUser.mockResolvedValueOnce([users[0]]);
    const single = await new SoundCloudArtistResolver(singleContext, { SEARCH: 'user' }).resolve();
    expect(single.identifier).toMatchObject({
      id: '1',
      type: ResourceType.Artist,
      src: TrackSource.SoundCloud,
      auth: false,
    });

    const context = makeContext({ selected: 1 });
    mocks.soundcloud.searchUser.mockResolvedValueOnce(users);
    const selected = await new SoundCloudArtistResolver(context, { SEARCH: 'user' }).resolve();
    expect(selected.identifier.id).toBe('2');
    expect(selected.selectionMessage).toBe(selectionMessage);
    expect(context.interaction.sendSelection).toHaveBeenCalledWith(
      'Choose a SoundCloud user',
      users.map(user => ({ name: user.username, url: user.permalink_url })),
      context.interaction.user,
    );
  });

  it('propagates artist selection cancellation', async () => {
    mocks.soundcloud.searchUser.mockResolvedValue([makeSoundCloudUser(1), makeSoundCloudUser(2)]);
    const context = makeContext();
    context.interaction.sendSelection.mockRejectedValue(new Error('selection cancelled'));
    await expect(
      new SoundCloudArtistResolver(context, { SEARCH: 'user' }).resolve(),
    ).rejects.toThrow('selection cancelled');
  });

  it('resolves MY through a saved account or authenticated client', async () => {
    const savedUser = makeSoundCloudUser(12);
    const context = makeContext({ user: { get: vi.fn().mockResolvedValue({ soundcloud: 12 }) } });
    mocks.soundcloud.getUser.mockResolvedValue(savedUser);
    const saved = await new SoundCloudArtistResolver(context, { MY: true }).resolve();
    expect(mocks.soundcloud.getUser).toHaveBeenCalledWith(12);
    expect(saved.identifier.auth).toBe(false);

    const authUser = makeSoundCloudUser(13);
    mocks.enabled.mockImplementation(flag => flag === FeatureFlag.SOUNDCLOUD_AUTH);
    mocks.authClient.getMe.mockResolvedValue(authUser);
    const authenticated = await new SoundCloudArtistResolver(context, { MY: true }).resolve();
    expect(context.interaction.user.getRequest).toHaveBeenCalledWith(
      context.interaction,
      TrackSource.SoundCloud,
    );
    expect(authenticated.identifier).toMatchObject({ id: '13', auth: true });
  });

  it('reports a missing saved SoundCloud account', async () => {
    const context = makeContext({ user: { get: vi.fn().mockResolvedValue({}) } });
    await expect(new SoundCloudArtistResolver(context, { MY: true }).resolve()).rejects.toThrow(
      'You have not set your SoundCloud account yet!',
    );
  });

  it('converts artist resources to posted-track resources', async () => {
    const user = makeSoundCloudUser(4);
    mocks.soundcloud.searchUser.mockResolvedValue([user]);
    const resource = await new SoundCloudTracksResolver(makeContext(), {
      SEARCH: 'tracks',
    }).resolve();
    expect(resource).toMatchObject({
      name: 'Posted Tracks',
      identifier: {
        type: ResourceType.Tracks,
        url: `${user.permalink_url}/tracks`,
      },
    });
  });

  it('fetches public or authenticated artist tracks', async () => {
    const tracks = [makeSoundCloudTrack(1), makeSoundCloudTrack(2)];
    mocks.soundcloud.getUserTracks.mockResolvedValue(tracks);
    await expect(new SoundCloudArtistFetcher(42).fetch()).resolves.toEqual({
      tracks: [
        { id: 1, mapped: true },
        { id: 2, mapped: true },
      ],
    });
    expect(mocks.soundcloud.getUserTracks).toHaveBeenCalledWith(42);

    mocks.authClient.getMyTracks.mockResolvedValue(tracks);
    await new SoundCloudArtistFetcher(mocks.authClient as never).fetch();
    expect(mocks.authClient.getMyTracks).toHaveBeenCalled();
  });
});

describe('SoundCloud song resolver and fetcher', () => {
  it('validates search, reports empty results, and honors FAST', async () => {
    await expect(new SoundCloudSongResolver(makeContext(), {}).resolve()).rejects.toThrow(
      'Missing SEARCH query for SoundCloud song.',
    );
    mocks.soundcloud.searchSongs.mockResolvedValue([]);
    await expect(
      new SoundCloudSongResolver(makeContext(), { SEARCH: 'missing', FAST: true }).resolve(),
    ).rejects.toThrow('No SoundCloud songs were found.');
    expect(mocks.soundcloud.searchSongs).toHaveBeenCalledWith('missing', 1);
  });

  it('resolves a single or selected song and propagates cancellation', async () => {
    const songs = [makeSoundCloudTrack(1), makeSoundCloudTrack(2)];
    mocks.soundcloud.searchSongs.mockResolvedValueOnce([songs[0]]);
    const single = await new SoundCloudSongResolver(makeContext(), { SEARCH: 'song' }).resolve();
    expect(single.identifier).toMatchObject({ id: '1', type: ResourceType.Song });

    const context = makeContext({ selected: 1 });
    mocks.soundcloud.searchSongs.mockResolvedValueOnce(songs);
    const selected = await new SoundCloudSongResolver(context, { SEARCH: 'song' }).resolve();
    expect(selected.identifier.id).toBe('2');
    expect(selected.selectionMessage).toBe(selectionMessage);

    mocks.soundcloud.searchSongs.mockResolvedValue(songs);
    context.interaction.sendSelection.mockRejectedValue(new Error('selection cancelled'));
    await expect(new SoundCloudSongResolver(context, { SEARCH: 'song' }).resolve()).rejects.toThrow(
      'selection cancelled',
    );
  });

  it('fetches an embedded track or reloads it by id', async () => {
    const track = makeSoundCloudTrack(5);
    await new SoundCloudSongFetcher(track.id, track).fetch();
    expect(mocks.soundcloud.getTrack).not.toHaveBeenCalled();

    mocks.soundcloud.getTrack.mockResolvedValue(track);
    await expect(new SoundCloudSongFetcher(5).fetch()).resolves.toEqual({
      tracks: [{ id: 5, mapped: true }],
      rangeOptimized: true,
    });
  });
});

describe('SoundCloud playlist resolver and fetcher', () => {
  it('requires search, reports empty results, and searches public playlists', async () => {
    await expect(new SoundCloudPlaylistResolver(makeContext(), {}).resolve()).rejects.toThrow(
      'You must specify a SEARCH query.',
    );
    mocks.soundcloud.searchPlaylists.mockResolvedValue([]);
    await expect(
      new SoundCloudPlaylistResolver(makeContext(), { SEARCH: 'missing', FAST: true }).resolve(),
    ).rejects.toThrow('No SoundCloud playlists were found.');
    expect(mocks.soundcloud.searchPlaylists).toHaveBeenCalledWith('missing', 1);
  });

  it('searches MY playlists with a saved user or auth client', async () => {
    const playlist = makeSoundCloudPlaylist();
    const context = makeContext({ user: { get: vi.fn().mockResolvedValue({ soundcloud: 88 }) } });
    mocks.soundcloud.searchPlaylists.mockResolvedValue([playlist]);
    await new SoundCloudPlaylistResolver(context, { SEARCH: 'mine', MY: true }).resolve();
    expect(mocks.soundcloud.searchPlaylists).toHaveBeenCalledWith('mine', 5, 88);

    mocks.enabled.mockReturnValue(true);
    mocks.authClient.searchMyPlaylists.mockResolvedValue([playlist]);
    const authenticated = await new SoundCloudPlaylistResolver(context, {
      SEARCH: 'mine',
      MY: true,
    }).resolve();
    expect(mocks.authClient.searchMyPlaylists).toHaveBeenCalledWith('mine', 5);
    expect(authenticated.identifier.auth).toBe(true);
  });

  it('reports a missing account for unauthenticated MY searches', async () => {
    const context = makeContext({ user: { get: vi.fn().mockResolvedValue({}) } });
    await expect(
      new SoundCloudPlaylistResolver(context, { SEARCH: 'mine', MY: true }).resolve(),
    ).rejects.toThrow("haven't set your SoundCloud account");
  });

  it('selects among playlists and propagates cancellation', async () => {
    const playlists = [makeSoundCloudPlaylist(1), makeSoundCloudPlaylist(2)];
    mocks.soundcloud.searchPlaylists.mockResolvedValue(playlists);
    const context = makeContext({ selected: 1 });
    const selected = await new SoundCloudPlaylistResolver(context, { SEARCH: 'list' }).resolve();
    expect(selected.identifier.id).toBe('2');
    expect(selected.selectionMessage).toBe(selectionMessage);

    context.interaction.sendSelection.mockRejectedValue(new Error('selection cancelled'));
    await expect(
      new SoundCloudPlaylistResolver(context, { SEARCH: 'list' }).resolve(),
    ).rejects.toThrow('selection cancelled');
  });

  it('uses complete embedded tracks or reloads incomplete playlists', async () => {
    const complete = makeSoundCloudPlaylist();
    await new SoundCloudPlaylistFetcher(complete.id, mocks.soundcloud as never, complete).fetch();
    expect(mocks.soundcloud.getPlaylist).not.toHaveBeenCalled();

    const full = makeSoundCloudPlaylist(9, { tracks: [makeSoundCloudTrack(1)] });
    const incomplete = makeSoundCloudPlaylist(9, { tracks: [], track_count: 1 });
    mocks.soundcloud.getPlaylist.mockResolvedValue(full);
    await expect(
      new SoundCloudPlaylistFetcher(9, mocks.soundcloud as never, incomplete).fetch(),
    ).resolves.toEqual({ tracks: [{ id: 1, mapped: true }] });
    expect(mocks.soundcloud.getPlaylist).toHaveBeenCalledWith(9);
  });
});

describe('SoundCloud favorites resolver and fetcher', () => {
  it('builds liked-track resources from artist resolution', async () => {
    const user = makeSoundCloudUser();
    mocks.soundcloud.searchUser.mockResolvedValue([user]);
    const context = makeContext();
    const resource = await new SoundCloudFavoritesResolver(context, { SEARCH: 'user' }).resolve();
    expect(resource).toMatchObject({
      name: 'Liked Tracks',
      authors: [user.username],
      identifier: {
        id: user.id.toString(),
        type: ResourceType.Likes,
        url: `${user.permalink_url}/likes`,
      },
    });
  });

  it('loads the user, forwards the range maximum, and creates progress for large lists', async () => {
    const user = makeSoundCloudUser(42, { public_favorites_count: 500 });
    mocks.soundcloud.getUser.mockResolvedValue(user);
    mocks.soundcloud.getUserFavorites.mockResolvedValue([makeSoundCloudTrack()]);
    mocks.getRangeOption.mockReturnValue({ start: 10, stop: 350 });
    const context = makeContext();
    const params = { TOP: { start: 10, stop: 350 } } as never;

    const result = await new SoundCloudFavoritesFetcher(
      42,
      params,
      context.interaction.channel,
    ).fetch();
    const [, max, progress] = mocks.soundcloud.getUserFavorites.mock.calls[0];
    expect(max).toBe(350);
    expect(progress).toBeDefined();
    expect(mocks.progressInstances.at(-1)).toEqual({
      sendable: context.interaction.channel,
      name: 'Fetching likes',
    });
    expect(result.tracks).toEqual([{ id: 7, mapped: true }]);
  });

  it('uses authenticated favorites without progress for small lists', async () => {
    const user = makeSoundCloudUser(3, { public_favorites_count: 20 });
    mocks.authClient.getMe.mockResolvedValue(user);
    mocks.authClient.getMyFavorites.mockResolvedValue([]);
    mocks.getRangeOption.mockReturnValue(undefined);
    await new SoundCloudFavoritesFetcher(
      mocks.authClient as never,
      {},
      makeContext().interaction,
    ).fetch();
    expect(mocks.authClient.getMyFavorites).toHaveBeenCalledWith(20, undefined);
  });
});

describe('SoundCloud URL resolver and fetcher factory', () => {
  it.each([
    [SoundCloudResourceType.TRACK, makeSoundCloudTrack(), ResourceType.Song],
    [SoundCloudResourceType.PLAYLIST, makeSoundCloudPlaylist(), ResourceType.Playlist],
    [SoundCloudResourceType.USER, makeSoundCloudUser(), ResourceType.Artist],
  ])('resolves %s URL resources', async (kind, resource, type) => {
    mocks.soundcloud.resolve.mockResolvedValue({ ...resource, kind });
    const resolved = await new SoundCloudUrlResolver('url').resolve();
    expect(resolved.identifier.type).toBe(type);
  });

  it('reports malformed or unsupported resources and propagates API errors', async () => {
    mocks.soundcloud.resolve.mockResolvedValueOnce(undefined);
    await expect(new SoundCloudUrlResolver('bad').resolve()).rejects.toThrow(
      'The SoundCloud URL is not valid!',
    );
    mocks.soundcloud.resolve.mockResolvedValueOnce({ kind: 'comment' });
    await expect(new SoundCloudUrlResolver('bad').resolve()).rejects.toThrow(
      'The SoundCloud URL is not valid!',
    );
    mocks.soundcloud.resolve.mockRejectedValueOnce(new Error('SoundCloud unavailable'));
    await expect(new SoundCloudUrlResolver('url').resolve()).rejects.toThrow(
      'SoundCloud unavailable',
    );
  });

  it('restores public and authenticated fetchers and rejects unsupported types', async () => {
    const context = makeContext();
    expect(
      await getSoundCloudSourceFetcher(
        { id: '1', src: TrackSource.SoundCloud, type: ResourceType.Song, url: 'url' },
        context,
        {},
      ),
    ).toBeInstanceOf(SoundCloudSongFetcher);
    expect(
      await getSoundCloudSourceFetcher(
        { id: '1', src: TrackSource.SoundCloud, type: ResourceType.Artist, url: 'url' },
        context,
        {},
      ),
    ).toBeInstanceOf(SoundCloudArtistFetcher);

    mocks.enabled.mockReturnValue(true);
    expect(
      await getSoundCloudSourceFetcher(
        {
          id: '1',
          src: TrackSource.SoundCloud,
          type: ResourceType.Likes,
          url: 'url',
          auth: true,
        },
        context,
        {},
      ),
    ).toBeInstanceOf(SoundCloudFavoritesFetcher);
    expect(mocks.createSoundCloudClient).toHaveBeenCalled();

    await expect(
      getSoundCloudSourceFetcher(
        { id: '1', src: TrackSource.SoundCloud, type: ResourceType.Album, url: 'url' },
        context,
        {},
      ),
    ).rejects.toThrow('Invalid type for SoundCloud fetcher');
  });

  it('marks user resources authenticated only when a client is attached', () => {
    const user = makeSoundCloudUser();
    expect(createSoundCloudUser({ value: { user } }).identifier.auth).toBe(false);
    expect(
      createSoundCloudUser({ value: { user, client: mocks.authClient as never } }).identifier.auth,
    ).toBe(true);
  });
});
