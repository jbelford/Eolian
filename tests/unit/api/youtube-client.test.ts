import { beforeEach, describe, expect, it, vi } from 'vitest';

const { videosList, playlistsList, playlistItemsList, searchList } = vi.hoisted(() => ({
  videosList: vi.fn(),
  playlistsList: vi.fn(),
  playlistItemsList: vi.fn(),
  searchList: vi.fn(),
}));

vi.mock('googleapis', () => ({
  google: {
    youtube: vi.fn(() => ({
      videos: { list: videosList },
      playlists: { list: playlistsList },
      playlistItems: { list: playlistItemsList },
      search: { list: searchList },
    })),
  },
}));
vi.mock('@eolian/api/bing', () => ({ bing: undefined }));

import { youtube } from '@eolian/api/youtube/youtube-client';

function snippet(title: string, channelTitle = 'Channel') {
  return {
    title,
    channelTitle,
    thumbnails: { default: { url: 'small' }, medium: { url: 'large' } },
  };
}

describe('YouTubeApi', () => {
  beforeEach(() => {
    videosList.mockReset();
    playlistsList.mockReset();
    playlistItemsList.mockReset();
    searchList.mockReset();
  });

  it.each([
    ['https://youtu.be/video-id', { video: 'video-id' }],
    [
      'https://youtube.com/watch?v=video-id&list=playlist-id',
      { video: 'video-id', playlist: 'playlist-id' },
    ],
    [
      'https://youtube.com/playlist?list=playlist-id',
      { video: undefined, playlist: 'playlist-id' },
    ],
    ['https://example.test/video-id', undefined],
  ])('identifies URL resources for %s', (url, expected) => {
    expect(youtube.getResourceType(url)).toEqual(expected);
  });

  it('maps video metadata and regional blocking', async () => {
    videosList.mockResolvedValue({
      data: {
        items: [
          {
            id: 'video',
            snippet: { ...snippet('A &amp; B'), liveBroadcastContent: 'live' },
            contentDetails: { regionRestriction: { blocked: ['US'] } },
          },
        ],
      },
    });
    await expect(youtube.getVideo('video')).resolves.toEqual({
      id: 'video',
      name: 'A & B',
      channelName: 'Channel',
      url: 'https://www.youtube.com/watch?v=video',
      artwork: 'large',
      isLive: true,
      blocked: true,
    });
  });

  it('returns undefined for missing singular resources', async () => {
    videosList.mockResolvedValue({ data: { items: [] } });
    playlistsList.mockResolvedValue({ data: {} });
    await expect(youtube.getVideo('missing')).resolves.toBeUndefined();
    await expect(youtube.getPlaylist('missing')).resolves.toBeUndefined();
  });

  it('paginates playlists, honors ranges, and filters unavailable videos', async () => {
    const progress = { init: vi.fn(), update: vi.fn(), done: vi.fn() };
    playlistItemsList
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              snippet: {
                ...snippet('One'),
                resourceId: { videoId: 'one' },
              },
              status: { privacyStatus: 'public' },
            },
          ],
          pageInfo: { totalResults: 120 },
          nextPageToken: 'next',
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              snippet: {
                title: 'Private',
                channelTitle: 'Channel',
                resourceId: { videoId: 'private' },
              },
              status: { privacyStatus: 'private' },
            },
            {
              snippet: {
                ...snippet('Two'),
                resourceId: { videoId: 'two' },
              },
              status: { privacyStatus: 'public' },
            },
          ],
        },
      });

    const result = await youtube.getPlaylistVideos('playlist', progress as never);
    expect(result.map(video => video.id)).toEqual(['one', 'two']);
    expect(playlistItemsList.mock.calls[1][0]).toMatchObject({ pageToken: 'next' });
    expect(progress.init).toHaveBeenCalledWith(120);
    expect(progress.update).toHaveBeenLastCalledWith(3);
    expect(progress.done).toHaveBeenCalledOnce();
  });

  it('rejects playlists without a total count', async () => {
    playlistItemsList.mockResolvedValue({ data: { items: [] } });
    await expect(youtube.getPlaylistVideos('playlist')).rejects.toThrow(
      'Playlist is missing total results',
    );
  });

  it('filters non-video and thumbnail-less search results before applying limits', async () => {
    searchList.mockResolvedValue({
      data: {
        items: [
          { id: { kind: 'youtube#channel', channelId: 'channel' }, snippet: snippet('Channel') },
          {
            id: { kind: 'youtube#video', videoId: 'no-image' },
            snippet: { title: 'No image', channelTitle: 'Channel', thumbnails: {} },
          },
          {
            id: { kind: 'youtube#video', videoId: 'video' },
            snippet: snippet('Video'),
          },
        ],
      },
    });
    await expect(youtube.searchVideos('query', 1)).resolves.toMatchObject([{ id: 'video' }]);
    expect(searchList).toHaveBeenCalledWith(expect.objectContaining({ q: 'query', maxResults: 3 }));
  });
});
