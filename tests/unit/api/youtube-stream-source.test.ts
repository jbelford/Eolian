import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter, once } from 'node:events';
import { PassThrough } from 'node:stream';

const { environment } = vi.hoisted(() => ({
  environment: {
    config: {
      ytDlpPath: '/tools/yt-dlp',
      ytDlpCookiesPath: undefined as string | undefined,
    },
    proxy: undefined as
      | {
          user: string;
          password: string;
          name: string;
        }
      | undefined,
  },
}));

vi.mock('@eolian/common/env', () => ({ environment }));

import { YouTubeStreamSource } from '@eolian/api/youtube/youtube-stream-source';

type FakeChild = EventEmitter & {
  stdout: PassThrough;
  stderr: PassThrough;
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
  kill: ReturnType<typeof vi.fn>;
};

function createChild(): FakeChild {
  return Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    exitCode: null,
    signalCode: null,
    kill: vi.fn(),
  });
}

describe('YouTubeStreamSource', () => {
  beforeEach(() => {
    environment.config.ytDlpPath = '/tools/yt-dlp';
    environment.config.ytDlpCookiesPath = undefined;
    environment.proxy = undefined;
  });

  it('streams the best available audio from yt-dlp stdout', async () => {
    const child = createChild();
    const spawn = vi.fn(() => child);
    const progress = { update: vi.fn() };
    const source = new YouTubeStreamSource(
      'https://youtube.test/watch?v=video-id',
      'video-id',
      progress as never,
      { spawn: spawn as never },
    );

    queueMicrotask(() => child.emit('spawn'));
    const stream = await source.get();
    const data = once(stream, 'data');
    child.stdout.write('audio');

    expect((await data)[0].toString()).toBe('audio');
    expect(progress.update).toHaveBeenCalledWith('📺 Fetching stream from YouTube...');
    expect(spawn).toHaveBeenCalledWith(
      '/tools/yt-dlp',
      [
        '--no-config',
        '--no-playlist',
        '--no-progress',
        '--js-runtimes',
        `node:${process.execPath}`,
        '--format',
        'bestaudio/best',
        '--output',
        '-',
        'https://youtube.test/watch?v=video-id',
      ],
      expect.objectContaining({
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
  });

  it('configures cookies and proxy environment', async () => {
    environment.config.ytDlpCookiesPath = '/run/secrets/youtube-cookies.txt';
    environment.proxy = {
      user: 'proxy-user',
      password: 'proxy-password',
      name: 'proxy.test',
    };
    const child = createChild();
    const spawn = vi.fn(() => child);

    queueMicrotask(() => child.emit('spawn'));
    await new YouTubeStreamSource('url', 'video-id', undefined, {
      spawn: spawn as never,
    }).get();

    const [, args, options] = spawn.mock.calls[0] as unknown as [
      string,
      string[],
      { env: NodeJS.ProcessEnv },
    ];
    expect(args).toContain('/run/secrets/youtube-cookies.txt');
    expect(options.env.HTTP_PROXY).toMatch(
      /^http:\/\/proxy-user-cc-us-sessid-[^:]+:proxy-password@proxy\.test$/,
    );
    expect(options.env.HTTPS_PROXY).toBe(options.env.HTTP_PROXY);
  });

  it('rejects when yt-dlp cannot start', async () => {
    const child = createChild();
    const error = new Error('spawn failed');

    queueMicrotask(() => child.emit('error', error));
    await expect(
      new YouTubeStreamSource('url', 'video-id', undefined, {
        spawn: vi.fn(() => child) as never,
      }).get(),
    ).rejects.toBe(error);
  });

  it('reports bounded yt-dlp diagnostics for a failed process', async () => {
    const child = createChild();
    queueMicrotask(() => child.emit('spawn'));
    const stream = await new YouTubeStreamSource('url', 'video-id', undefined, {
      spawn: vi.fn(() => child) as never,
    }).get();
    const error = once(stream, 'error');

    child.stderr.write('media unavailable');
    child.exitCode = 1;
    child.emit('close', 1);

    await expect(error).resolves.toEqual([
      expect.objectContaining({
        message: 'yt-dlp exited with code 1: media unavailable',
      }),
    ]);
  });

  it('terminates yt-dlp when the consumer closes the stream', async () => {
    const child = createChild();
    queueMicrotask(() => child.emit('spawn'));
    const stream = await new YouTubeStreamSource('url', 'video-id', undefined, {
      spawn: vi.fn(() => child) as never,
    }).get();

    const closed = once(stream, 'close');
    stream.destroy();
    await closed;

    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
  });
});
