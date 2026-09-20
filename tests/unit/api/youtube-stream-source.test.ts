import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';

const {
  chooseFormat,
  decipher,
  getBasicInfo,
  create,
  createFetchFunction,
  createProxyUrl,
  generatePoToken,
  httpRequest,
  environment,
  platform,
} = vi.hoisted(() => {
  const decipher = vi.fn();
  const chooseFormat = vi.fn(() => ({ decipher }));
  return {
    chooseFormat,
    decipher,
    getBasicInfo: vi.fn(() => ({ chooseFormat })),
    create: vi.fn(),
    createFetchFunction: vi.fn(),
    createProxyUrl: vi.fn(),
    generatePoToken: vi.fn(),
    httpRequest: vi.fn(),
    environment: {
      tokens: { youtube: { cookie: '' } },
      flags: { enablePoTokenGen: false },
    },
    platform: { shim: {} as { eval?: (data: unknown, env: unknown) => Promise<unknown> } },
  };
});

vi.mock('youtubei.js', () => ({
  Innertube: { create },
  Platform: platform,
  Types: {},
  UniversalCache: vi.fn(),
}));
vi.mock('@eolian/api/youtube/potoken', () => ({
  createFetchFunction,
  createProxyUrl,
  generatePoToken,
}));
vi.mock('@eolian/http', () => ({ httpRequest }));
vi.mock('@eolian/common/env', () => ({ environment }));

import { YouTubeStreamSource } from '@eolian/api/youtube/youtube-stream-source';

describe('YouTubeStreamSource', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    environment.tokens.youtube.cookie = '';
    environment.flags.enablePoTokenGen = false;
    createProxyUrl.mockReturnValue('http://proxy.test');
    createFetchFunction.mockReturnValue('fetch-function');
    decipher.mockResolvedValue('https://stream.test/audio');
    create.mockResolvedValue({
      getBasicInfo,
      session: { player: 'player' },
    });
    httpRequest.mockResolvedValue(Readable.from('audio'));
  });

  it('evaluates player scripts with only the supplied signature helpers', async () => {
    const result = await platform.shim.eval!(
      {
        output: `
          const exportedVars = {
            nFunction: value => "n-" + value,
            sigFunction: value => "sig-" + value,
          };`,
      },
      { n: 'one', sig: 'two' },
    );

    expect(result).toEqual({ n: 'n-one', sig: 'sig-two' });
  });

  it('creates an Innertube session, selects the best format, and requests its stream', async () => {
    const progress = { update: vi.fn() };
    const source = new YouTubeStreamSource(
      'https://youtube.test/watch?v=id',
      'video-id',
      progress as never,
    );

    const stream = await source.get(12_000);

    expect(createFetchFunction).toHaveBeenCalledWith('http://proxy.test');
    expect(create).toHaveBeenCalledWith({
      cache: expect.anything(),
      generate_session_locally: true,
      cookie: undefined,
      fetch: 'fetch-function',
    });
    expect(progress.update).toHaveBeenCalledWith('📺 Fetching information from YouTube...');
    expect(getBasicInfo).toHaveBeenCalledWith('video-id');
    expect(chooseFormat).toHaveBeenCalledWith({ quality: 'best' });
    expect(decipher).toHaveBeenCalledWith('player');
    expect(httpRequest).toHaveBeenCalledWith('https://stream.test/audio', {
      proxy: 'http://proxy.test',
    });
    expect(stream).toBeInstanceOf(Readable);
  });

  it('adds cookies and generated proof-of-origin tokens when enabled', async () => {
    environment.tokens.youtube.cookie = 'SID=cookie';
    environment.flags.enablePoTokenGen = true;
    generatePoToken.mockResolvedValue({ poToken: 'po-token', visitorData: 'visitor-data' });

    await new YouTubeStreamSource('url', 'video-id').get();

    expect(generatePoToken).toHaveBeenCalledWith('fetch-function', false);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        cookie: 'SID=cookie',
        po_token: 'po-token',
        visitor_data: 'visitor-data',
      }),
    );
  });

  it('propagates metadata and stream request failures', async () => {
    const metadataError = new Error('metadata failed');
    getBasicInfo.mockRejectedValueOnce(metadataError);
    await expect(new YouTubeStreamSource('url', 'video-id').get()).rejects.toBe(metadataError);

    const streamError = new Error('stream failed');
    httpRequest.mockRejectedValueOnce(streamError);
    await expect(new YouTubeStreamSource('url', 'video-id').get()).rejects.toBe(streamError);
  });
});
