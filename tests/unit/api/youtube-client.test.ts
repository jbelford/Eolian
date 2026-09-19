import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackSource } from '@eolian/api/@types';

const { videosList, playlistsList, playlistItemsList, searchList, searchYoutubeSong } = vi.hoisted(
  () => ({
    videosList: vi.fn(),
    playlistsList: vi.fn(),
    playlistItemsList: vi.fn(),
    searchList: vi.fn(),
    searchYoutubeSong: vi.fn(),
  }),
);

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
vi.mock('@eolian/api/bing', () => ({ bing: { searchYoutubeSong } }));

import { youtube } from '@eolian/api/youtube/youtube-client';
import { YouTubeStreamSource } from '@eolian/api/youtube/youtube-stream-source';

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
    searchYoutubeSong.mockReset();
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

  it('maps playlist metadata and propagates API failures', async () => {
    playlistsList.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'playlist',
            snippet: { title: 'A &amp; B', channelTitle: 'Channel' },
            contentDetails: { itemCount: 12 },
          },
        ],
      },
    });
    await expect(youtube.getPlaylist('playlist')).resolves.toEqual({
      id: 'playlist',
      name: 'A & B',
      channelName: 'Channel',
      videos: 12,
      url: 'https://www.youtube.com/playlist?list=playlist',
    });

    const error = new Error('YouTube unavailable');
    videosList.mockRejectedValueOnce(error);
    await expect(youtube.getVideo('video')).rejects.toBe(error);
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
                ...snippet('Private'),
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
    expect(playlistItemsList.mock.calls[1][0].part).toContain('status');
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

  it('fetches enough playlist pages for a requested range and slices the result', async () => {
    const items = (start: number, count: number) =>
      Array.from({ length: count }, (_, index) => ({
        snippet: {
          ...snippet(`Video ${start + index}`),
          resourceId: { videoId: String(start + index) },
        },
        status: { privacyStatus: 'public' },
      }));
    playlistItemsList
      .mockResolvedValueOnce({
        data: {
          items: items(0, 50),
          pageInfo: { totalResults: 120 },
          nextPageToken: 'page-two',
        },
      })
      .mockResolvedValueOnce({
        data: { items: items(50, 50), nextPageToken: 'page-three' },
      });

    const result = await youtube.getPlaylistVideos('playlist', undefined, () => ({
      start: 55,
      stop: 57,
    }));

    expect(result.map(video => video.id)).toEqual(['55', '56']);
    expect(playlistItemsList).toHaveBeenCalledTimes(2);
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

  it('maps playlist searches and returns empty API responses', async () => {
    searchList
      .mockResolvedValueOnce({
        data: {
          items: [
            {
              id: { playlistId: 'playlist' },
              snippet: { title: 'A &amp; B', channelTitle: 'Channel' },
            },
          ],
        },
      })
      .mockResolvedValueOnce({ data: {} });

    await expect(youtube.searchPlaylists('mix', 2)).resolves.toEqual([
      {
        id: 'playlist',
        name: 'A & B',
        channelName: 'Channel',
        videos: undefined,
        url: 'https://www.youtube.com/playlist?list=playlist',
      },
    ]);
    await expect(youtube.searchVideos('missing')).resolves.toEqual([]);
  });

  it('uses Bing results, falls back for low scores, and caches stream lookups', async () => {
    const bingTrack = {
      id: 'bing',
      title: 'Song (Official Music Video)',
      poster: 'Artist',
      src: TrackSource.YouTube,
      url: 'https://youtube.test/bing',
      score: 70,
    };
    searchYoutubeSong.mockResolvedValue([bingTrack]);
    searchList.mockResolvedValue({
      data: {
        items: [
          {
            id: { kind: 'youtube#video', videoId: 'youtube' },
            snippet: snippet('Song audio'),
          },
        ],
      },
    });

    const track = {
      id: 'spotify-id',
      title: 'Song',
      poster: 'Artist',
      src: TrackSource.Spotify,
      url: 'https://spotify.test/song',
    };
    const first = await youtube.searchStream(track);
    const second = await youtube.searchStream(track);

    expect(first).toBeInstanceOf(YouTubeStreamSource);
    expect(second).toBeInstanceOf(YouTubeStreamSource);
    expect(searchYoutubeSong).toHaveBeenCalledOnce();
    expect(searchList).toHaveBeenCalledOnce();
  });

  it('returns no stream for empty searches and rejects non-YouTube direct streams', async () => {
    searchYoutubeSong.mockRejectedValue(new Error('bing unavailable'));
    searchList.mockResolvedValue({ data: { items: [] } });

    await expect(
      youtube.searchStream({
        id: 'missing-id',
        title: 'Missing',
        poster: 'Artist',
        src: TrackSource.Spotify,
        url: 'url',
      }),
    ).resolves.toBeUndefined();

    await expect(
      youtube.getStream({
        title: 'Song',
        poster: 'Artist',
        src: TrackSource.SoundCloud,
        url: 'url',
      }),
    ).rejects.toThrow('non-youtube resource');
  });

  it('creates direct stream sources for YouTube tracks', async () => {
    await expect(
      youtube.getStream({
        id: 'video-id',
        title: 'Song',
        poster: 'Artist',
        src: TrackSource.YouTube,
        url: 'https://youtube.test/video-id',
      }),
    ).resolves.toBeInstanceOf(YouTubeStreamSource);
  });
});
