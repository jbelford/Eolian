import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackSource } from '@eolian/api/@types';
import { ResourceType } from '@eolian/data/@types';
import {
  makeContext,
  makeYouTubePlaylist,
  makeYouTubeVideo,
  selectionMessage,
} from './resolver-test-utils';

const mocks = vi.hoisted(() => {
  const progressInstances: Array<{ sendable: unknown; name: string }> = [];
  return {
    youtube: {
      searchVideos: vi.fn(),
      searchPlaylists: vi.fn(),
      getVideo: vi.fn(),
      getPlaylist: vi.fn(),
      getPlaylistVideos: vi.fn(),
      getResourceType: vi.fn(),
    },
    mapYouTubeVideo: vi.fn(),
    getRangeOption: vi.fn(),
    progressInstances,
  };
});

vi.mock('@eolian/api', () => ({
  youtube: mocks.youtube,
  mapYouTubeVideo: mocks.mapYouTubeVideo,
}));
vi.mock('@eolian/command-options', () => ({ getRangeOption: mocks.getRangeOption }));
vi.mock('@eolian/framework', () => ({
  DownloaderDisplay: class {
    constructor(sendable: unknown, name: string) {
      mocks.progressInstances.push({ sendable, name });
    }
  },
}));

import {
  createYouTubePlaylist,
  YouTubePlaylistFetcher,
  YouTubePlaylistResolver,
} from '@eolian/resolvers/youtube/youtube-playlist-resolver';
import { YouTubeUrlResolver } from '@eolian/resolvers/youtube/youtube-url-resolver';
import {
  createYouTubeVideo,
  YouTubeVideoFetcher,
  YouTubeVideoResolver,
} from '@eolian/resolvers/youtube/youtube-video-resolver';
import { getYouTubeSourceFetcher } from '@eolian/resolvers/youtube';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.mapYouTubeVideo.mockImplementation(video => ({ id: video.id, mapped: true }));
  mocks.progressInstances.length = 0;
});

describe('YouTubeVideoResolver', () => {
  it('requires a query, reports empty results, and honors FAST', async () => {
    await expect(new YouTubeVideoResolver(makeContext(), {}).resolve()).rejects.toThrow(
      'Missing search query for YouTube song.',
    );

    mocks.youtube.searchVideos.mockResolvedValue([]);
    await expect(
      new YouTubeVideoResolver(makeContext(), { SEARCH: 'missing', FAST: true }).resolve(),
    ).rejects.toThrow('No YouTube videos were found.');
    expect(mocks.youtube.searchVideos).toHaveBeenCalledWith('missing', 1);
  });

  it('resolves a single search result without selection', async () => {
    const video = makeYouTubeVideo();
    mocks.youtube.searchVideos.mockResolvedValue([video]);
    const context = makeContext();

    const resource = await new YouTubeVideoResolver(context, { SEARCH: 'video' }).resolve();

    expect(resource).toMatchObject({
      name: video.name,
      authors: [video.channelName],
      identifier: {
        id: video.id,
        src: TrackSource.YouTube,
        type: ResourceType.Song,
        url: video.url,
      },
    });
    expect(context.interaction.sendSelection).not.toHaveBeenCalled();
  });

  it('uses the selected search result and propagates cancellation', async () => {
    const videos = [makeYouTubeVideo('one'), makeYouTubeVideo('two')];
    mocks.youtube.searchVideos.mockResolvedValue(videos);
    const context = makeContext({ selected: 1 });

    const resource = await new YouTubeVideoResolver(context, { SEARCH: 'video' }).resolve();
    expect(context.interaction.sendSelection).toHaveBeenCalledWith(
      'Choose a YouTube video',
      videos.map(video => ({ name: video.name, url: video.url })),
      context.interaction.user,
    );
    expect(resource.identifier.id).toBe('two');
    expect(resource.selectionMessage).toBe(selectionMessage);

    context.interaction.sendSelection.mockRejectedValue(new Error('selection cancelled'));
    await expect(new YouTubeVideoResolver(context, { SEARCH: 'video' }).resolve()).rejects.toThrow(
      'selection cancelled',
    );
  });

  it('fetches embedded and persisted videos and reports unavailable resources', async () => {
    const video = makeYouTubeVideo();
    await expect(createYouTubeVideo(video).fetcher.fetch()).resolves.toEqual({
      tracks: [{ id: video.id, mapped: true }],
      rangeOptimized: true,
    });
    expect(mocks.youtube.getVideo).not.toHaveBeenCalled();

    mocks.youtube.getVideo.mockResolvedValueOnce(video);
    await expect(new YouTubeVideoFetcher(video.id).fetch()).resolves.toEqual({
      tracks: [{ id: video.id, mapped: true }],
      rangeOptimized: true,
    });
    mocks.youtube.getVideo.mockResolvedValueOnce(undefined);
    await expect(new YouTubeVideoFetcher('missing').fetch()).rejects.toThrow(
      'https://www.youtube.com/watch?v=missing',
    );
    mocks.youtube.getVideo.mockResolvedValueOnce(makeYouTubeVideo('blocked', { blocked: true }));
    await expect(new YouTubeVideoFetcher('blocked').fetch()).rejects.toThrow(
      'blocked in my region',
    );
  });
});

describe('YouTubePlaylistResolver and fetcher', () => {
  it('validates search results and uses FAST', async () => {
    await expect(new YouTubePlaylistResolver(makeContext(), {}).resolve()).rejects.toThrow(
      'Missing search query for YouTube playlist.',
    );
    mocks.youtube.searchPlaylists.mockResolvedValue([]);
    await expect(
      new YouTubePlaylistResolver(makeContext(), { SEARCH: 'missing', FAST: true }).resolve(),
    ).rejects.toThrow('No YouTube playlists were found.');
    expect(mocks.youtube.searchPlaylists).toHaveBeenCalledWith('missing', 1);
  });

  it('resolves one playlist or the selected playlist', async () => {
    const playlists = [makeYouTubePlaylist('one'), makeYouTubePlaylist('two')];
    const singleContext = makeContext();
    mocks.youtube.searchPlaylists.mockResolvedValueOnce([playlists[0]]);
    const single = await new YouTubePlaylistResolver(singleContext, {
      SEARCH: 'playlist',
    }).resolve();
    expect(single.identifier.id).toBe('one');
    expect(singleContext.interaction.sendSelection).not.toHaveBeenCalled();

    const context = makeContext({ selected: 1 });
    mocks.youtube.searchPlaylists.mockResolvedValueOnce(playlists);
    const selected = await new YouTubePlaylistResolver(context, { SEARCH: 'playlist' }).resolve();
    expect(selected.identifier.id).toBe('two');
    expect(selected.selectionMessage).toBe(selectionMessage);
    expect(context.interaction.sendSelection).toHaveBeenCalledWith(
      'Choose a YouTube playlist',
      playlists.map(playlist => ({ name: playlist.name, url: playlist.url })),
      context.interaction.user,
    );
  });

  it('propagates playlist selection cancellation', async () => {
    mocks.youtube.searchPlaylists.mockResolvedValue([
      makeYouTubePlaylist('one'),
      makeYouTubePlaylist('two'),
    ]);
    const context = makeContext();
    context.interaction.sendSelection.mockRejectedValue(new Error('selection cancelled'));
    await expect(
      new YouTubePlaylistResolver(context, { SEARCH: 'playlist' }).resolve(),
    ).rejects.toThrow('selection cancelled');
  });

  it('forwards progress and range calculation while mapping fetched videos', async () => {
    const context = makeContext();
    const videos = [makeYouTubeVideo('one'), makeYouTubeVideo('two')];
    mocks.youtube.getPlaylistVideos.mockResolvedValue(videos);
    mocks.getRangeOption.mockReturnValue({ start: 2, stop: 4 });
    const params = { TOP: { start: 2, stop: 4 } } as never;

    const result = await new YouTubePlaylistFetcher(
      'playlist',
      params,
      context.interaction.channel,
    ).fetch();
    const [, progress, rangeFn] = mocks.youtube.getPlaylistVideos.mock.calls[0];

    expect(mocks.progressInstances.at(-1)).toEqual({
      sendable: context.interaction.channel,
      name: 'Fetching playlist tracks',
    });
    expect(rangeFn(10)).toEqual({ start: 2, stop: 4 });
    expect(mocks.getRangeOption).toHaveBeenCalledWith(params, 10);
    expect(progress).toBeDefined();
    expect(result).toEqual({
      tracks: [
        { id: 'one', mapped: true },
        { id: 'two', mapped: true },
      ],
      rangeOptimized: true,
    });
  });
});

describe('YouTubeUrlResolver', () => {
  it('rejects malformed URLs', async () => {
    mocks.youtube.getResourceType.mockReturnValue(undefined);
    await expect(new YouTubeUrlResolver('bad', {}, makeContext()).resolve()).rejects.toThrow(
      'The YouTube URL provided is not valid!',
    );
    mocks.youtube.getResourceType.mockReturnValue({});
    await expect(new YouTubeUrlResolver('empty', {}, makeContext()).resolve()).rejects.toThrow(
      'The YouTube URL provided is not valid!',
    );
  });

  it('lets the user choose between a video and playlist', async () => {
    const video = makeYouTubeVideo('video');
    const playlist = makeYouTubePlaylist('playlist');
    mocks.youtube.getResourceType.mockImplementation(() => ({
      video: video.id,
      playlist: playlist.id,
    }));
    mocks.youtube.getVideo.mockResolvedValue(video);
    mocks.youtube.getPlaylist.mockResolvedValue(playlist);

    const videoContext = makeContext({ selected: 0 });
    const videoResource = await new YouTubeUrlResolver('url', {}, videoContext).resolve();
    expect(videoResource.identifier.type).toBe(ResourceType.Song);
    expect(videoResource.selectionMessage).toBe(selectionMessage);
    expect(mocks.youtube.getPlaylist).not.toHaveBeenCalled();

    const playlistContext = makeContext({ selected: 1 });
    const playlistResource = await new YouTubeUrlResolver('url', {}, playlistContext).resolve();
    expect(playlistResource.identifier.type).toBe(ResourceType.Playlist);
    expect(playlistResource.selectionMessage).toBe(selectionMessage);
  });

  it('propagates URL selection cancellation', async () => {
    mocks.youtube.getResourceType.mockReturnValue({ video: 'video', playlist: 'playlist' });
    const context = makeContext();
    context.interaction.sendSelection.mockRejectedValue(new Error('selection cancelled'));
    await expect(new YouTubeUrlResolver('url', {}, context).resolve()).rejects.toThrow(
      'selection cancelled',
    );
  });

  it('reports missing and blocked URL videos', async () => {
    mocks.youtube.getResourceType.mockReturnValue({ video: 'video' });
    mocks.youtube.getVideo.mockResolvedValueOnce(undefined);
    await expect(new YouTubeUrlResolver('url', {}, makeContext()).resolve()).rejects.toThrow(
      'could not find details about this video',
    );
    mocks.youtube.getVideo.mockResolvedValueOnce(makeYouTubeVideo('video', { blocked: true }));
    await expect(new YouTubeUrlResolver('url', {}, makeContext()).resolve()).rejects.toThrow(
      'blocked in my region',
    );
  });

  it.each([
    ['RDMM-generated', "can't add 'My Mix' playlists"],
    ['LM', "can't add 'Your Likes' playlists"],
  ])('rejects unsupported playlist %s with selection context', async (id, message) => {
    mocks.youtube.getResourceType.mockReturnValue({ video: 'video', playlist: id });
    const context = makeContext({ selected: 1 });
    const promise = new YouTubeUrlResolver('url', {}, context).resolve();
    await expect(promise).rejects.toThrow(message);
    await expect(promise).rejects.toMatchObject({ context: selectionMessage });
  });

  it('reports a missing URL playlist', async () => {
    mocks.youtube.getResourceType.mockReturnValue({ playlist: 'missing' });
    mocks.youtube.getPlaylist.mockResolvedValue(undefined);
    await expect(new YouTubeUrlResolver('url', {}, makeContext()).resolve()).rejects.toThrow(
      'could not find details about this playlist',
    );
  });
});

describe('YouTube fetcher factory', () => {
  it('restores playlist and video fetchers and rejects unsupported identifiers', () => {
    const context = makeContext();
    expect(
      getYouTubeSourceFetcher(
        { id: 'playlist', src: TrackSource.YouTube, type: ResourceType.Playlist, url: 'url' },
        context,
        {},
      ),
    ).toBeInstanceOf(YouTubePlaylistFetcher);
    expect(
      getYouTubeSourceFetcher(
        { id: 'video', src: TrackSource.YouTube, type: ResourceType.Song, url: 'url' },
        context,
        {},
      ),
    ).toBeInstanceOf(YouTubeVideoFetcher);
    expect(() =>
      getYouTubeSourceFetcher(
        { id: 'bad', src: TrackSource.YouTube, type: ResourceType.Artist, url: 'url' },
        context,
        {},
      ),
    ).toThrow('Invalid type for YouTube fetcher');
  });

  it('creates playlist identifiers with the provided sender and message', () => {
    const context = makeContext();
    const playlist = makeYouTubePlaylist();
    const resource = createYouTubePlaylist(
      playlist,
      {},
      context.interaction.channel,
      selectionMessage,
    );
    expect(resource.identifier).toMatchObject({
      id: playlist.id,
      type: ResourceType.Playlist,
      src: TrackSource.YouTube,
    });
    expect(resource.selectionMessage).toBe(selectionMessage);
  });
});
