import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackSource } from '@eolian/api/@types';

const { fuzzyMatch, httpRequest, warn } = vi.hoisted(() => ({
  fuzzyMatch: vi.fn(),
  httpRequest: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@eolian/common/env', () => ({
  environment: {
    tokens: { bing: { key: 'bing-key', configId: 'config-id' } },
  },
}));
vi.mock('@eolian/common/logger', () => ({
  logger: { info: vi.fn(), warn },
}));
vi.mock('@eolian/common/util', () => ({ fuzzyMatch }));
vi.mock('@eolian/http', () => ({ httpRequest }));

import { bing } from '@eolian/api/bing/bing-client';

function video(id: string, creator = 'Artist', publisher = 'YouTube', duration = 'PT3M') {
  return {
    id,
    name: `Song ${id}`,
    duration,
    contentUrl: `https://youtube.test/${id}`,
    publisher: [{ name: publisher }],
    creator: creator ? { name: creator } : undefined,
  };
}

describe('BingApi', () => {
  beforeEach(() => {
    httpRequest.mockReset();
    fuzzyMatch.mockReset();
  });

  it('constructs authenticated searches and filters by creator and publisher', async () => {
    httpRequest.mockResolvedValue({
      value: [
        video('matching'),
        video('wrong-publisher', 'Artist', 'Vimeo'),
        video('missing-creator', ''),
      ],
    });

    await expect(bing!.searchVideos('artist song', 'YouTube', 7)).resolves.toEqual([
      video('matching'),
    ]);
    expect(httpRequest).toHaveBeenCalledWith(
      'https://api.bing.microsoft.com/v7.0/custom/videos/search',
      {
        params: {
          q: 'artist song',
          count: 7,
          pricing: 'Free',
          safeSearch: 'Off',
          customConfig: 'config-id',
        },
        headers: { 'Ocp-Apim-Subscription-Key': 'bing-key' },
        json: true,
      },
    );
  });

  it('keeps all creator-backed results when no publisher is requested', async () => {
    httpRequest.mockResolvedValue({
      value: [video('youtube'), video('vimeo', 'Artist', 'Vimeo'), video('missing-creator', '')],
    });

    await expect(bing!.searchVideos('artist song')).resolves.toEqual([
      video('youtube'),
      video('vimeo', 'Artist', 'Vimeo'),
    ]);
  });

  it('maps fuzzy matches and uses duration to break close-score ties', async () => {
    httpRequest.mockResolvedValue({
      value: [
        video('long', 'Artist', 'YouTube', 'PT5M'),
        video('exact', 'Artist', 'YouTube', 'PT3M'),
      ],
    });
    fuzzyMatch.mockResolvedValue([
      { key: 0, score: 90 },
      { key: 1, score: 89 },
    ]);

    const tracks = await bing!.searchYoutubeSong('Song', 'Artist', 180_000);

    expect(fuzzyMatch).toHaveBeenCalledWith('Artist Song', [
      'Artist Song long',
      'Artist Song exact',
    ]);
    expect(tracks).toEqual([
      {
        id: 'exact',
        poster: 'Artist',
        src: TrackSource.YouTube,
        url: 'https://youtube.test/exact',
        title: 'Song exact',
        stream: 'https://youtube.test/exact',
        score: 89,
      },
      expect.objectContaining({ id: 'long', score: 90 }),
    ]);
  });

  it('returns no tracks for an empty response and propagates request failures', async () => {
    httpRequest.mockResolvedValueOnce({ value: [] });
    await expect(bing!.searchYoutubeSong('Missing', 'Artist')).resolves.toEqual([]);

    const error = new Error('offline');
    httpRequest.mockRejectedValueOnce(error);
    await expect(bing!.searchVideos('query')).rejects.toBe(error);
    expect(warn).toHaveBeenCalled();
  });
});
