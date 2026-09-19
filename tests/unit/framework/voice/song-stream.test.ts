import { Readable, Transform, TransformCallback } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StreamSource, Track, TrackSource } from '@eolian/api/@types';
import { RetrySleepAlgorithm } from '@eolian/common/@types';
import { RequestErrorCodes } from '@eolian/http';

const prismMocks = vi.hoisted(() => ({
  ffmpegs: [] as MockFfmpeg[],
  volumes: [] as MockVolumeTransformer[],
}));

class MockTransform extends Transform {
  readonly pipeCalls: { destination: NodeJS.WritableStream; options?: { end?: boolean } }[] = [];
  destroyCount = 0;
  unpipeCount = 0;

  override pipe<T extends NodeJS.WritableStream>(destination: T, options?: { end?: boolean }): T {
    this.pipeCalls.push({ destination, options });
    return super.pipe(destination, options);
  }

  override unpipe(destination?: NodeJS.WritableStream): this {
    this.unpipeCount++;
    return super.unpipe(destination);
  }

  override destroy(error?: Error): this {
    this.destroyCount++;
    return super.destroy(error);
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback) {
    callback(null, chunk);
  }
}

class MockFfmpeg extends MockTransform {
  constructor(readonly args: string[]) {
    super();
  }
}

class MockVolumeTransformer extends MockTransform {
  volume: number;
  endCount = 0;

  constructor(volume: number) {
    super();
    this.volume = volume;
  }

  setVolume(volume: number) {
    this.volume = volume;
  }

  override end(): this {
    this.endCount++;
    return super.end();
  }
}

vi.mock('prism-media', () => ({
  default: {
    FFmpeg: class {
      constructor({ args }: { args: string[] }) {
        const ffmpeg = new MockFfmpeg(args);
        prismMocks.ffmpegs.push(ffmpeg);
        return ffmpeg;
      }
    },
    VolumeTransformer: class {
      constructor({ volume }: { volume: number }) {
        const output = new MockVolumeTransformer(volume);
        prismMocks.volumes.push(output);
        return output;
      }
    },
  },
}));

const loggerMocks = vi.hoisted(() => ({
  debug: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('@eolian/common/logger', () => ({ logger: loggerMocks }));
vi.mock('@eolian/api', () => ({ getTrackStream: vi.fn() }));
vi.mock('@eolian/http', () => ({
  RequestErrorCodes: { ABORTED: 'UND_ERR_ABORTED' },
}));

import {
  buildFfmpegArguments,
  SongStream,
  SongStreamDependencies,
} from '@eolian/framework/voice/song-stream';

const BASE_ARGUMENTS = [
  '-analyzeduration',
  '0',
  '-loglevel',
  '0',
  '-f',
  's16le',
  '-ar',
  '48000',
  '-ac',
  '2',
];
const NIGHTCORE = 'asetrate=48000*1.25,atempo=1.06';
const BASS = 'equalizer=f=150:width_type=h:width=100:g=15';

class MockReadable extends Readable {
  destroyCount = 0;

  override _read() {}

  override destroy(error?: Error): this {
    this.destroyCount++;
    return super.destroy(error);
  }
}

function track(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-id',
    title: 'Track',
    poster: 'Artist',
    url: 'https://example.com/track',
    src: TrackSource.YouTube,
    ...overrides,
  };
}

function source(...streams: (Readable | Error)[]) {
  const get = vi.fn(async () => {
    const result = streams.shift();
    if (result instanceof Error) {
      throw result;
    }
    if (!result) {
      throw new Error('No mock stream configured');
    }
    return result;
  });
  return { source: { get } satisfies StreamSource, get };
}

function sleepAlgorithm() {
  const algorithm = {
    count: 0,
    reset: vi.fn(() => {
      algorithm.count = 0;
    }),
    sleep: vi.fn(async () => {
      algorithm.count++;
    }),
  } satisfies RetrySleepAlgorithm;
  return algorithm;
}

function harness({
  streams = [new MockReadable()],
  retries = 1,
  now = vi.fn(() => 10_000),
}: {
  streams?: (Readable | Error)[];
  retries?: number;
  now?: ReturnType<typeof vi.fn<() => number>>;
} = {}) {
  const streamSource = source(...streams);
  const getTrackStream = vi.fn().mockResolvedValue(streamSource.source);
  const sleep = sleepAlgorithm();
  const dependencies: Partial<SongStreamDependencies> = {
    getTrackStream,
    sleepAlgorithm: sleep,
    now,
  };
  return {
    song: new SongStream(0.5, retries, dependencies),
    getTrackStream,
    source: streamSource.source,
    sourceGet: streamSource.get,
    sleep,
    now,
  };
}

async function waitForCall(mock: ReturnType<typeof vi.fn>, count: number) {
  await vi.waitFor(() => expect(mock).toHaveBeenCalledTimes(count));
}

describe('buildFfmpegArguments', () => {
  it.each([
    ['no effects', undefined, undefined, BASE_ARGUMENTS],
    ['nightcore', undefined, { nightcore: true }, [...BASE_ARGUMENTS, '-af', NIGHTCORE]],
    ['bass', undefined, { bass: true }, [...BASE_ARGUMENTS, '-af', BASS]],
    [
      'both effects in nightcore-then-bass order',
      undefined,
      { nightcore: true, bass: true },
      [...BASE_ARGUMENTS, '-af', `${NIGHTCORE}, ${BASS}`],
    ],
    ['live-track effects suppressed', true, { nightcore: true, bass: true }, BASE_ARGUMENTS],
  ])('builds arguments for %s', (_name, live, options, expected) => {
    expect(buildFfmpegArguments(live, options)).toEqual(expected);
  });

  it('returns a fresh base argument array', () => {
    const first = buildFfmpegArguments();
    first.push('changed');
    expect(buildFfmpegArguments()).toEqual(BASE_ARGUMENTS);
  });
});

describe('SongStream', () => {
  beforeEach(() => {
    prismMocks.ffmpegs.length = 0;
    prismMocks.volumes.length = 0;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('acquires the source and wires source, FFmpeg, and persistent output', async () => {
    const input = new MockReadable();
    const { song, getTrackStream, sourceGet } = harness({ streams: [input] });
    const progress = { init: vi.fn(), update: vi.fn(), done: vi.fn() };
    const inputPipe = vi.spyOn(input, 'pipe');

    await expect(song.setStreamTrack(track(), { bass: true }, false, 123, progress)).resolves.toBe(
      true,
    );

    const ffmpeg = prismMocks.ffmpegs[0];
    const output = prismMocks.volumes[0];
    expect(getTrackStream).toHaveBeenCalledWith(track(), progress);
    expect(sourceGet).toHaveBeenCalledWith(123);
    expect(ffmpeg.args).toEqual([...BASE_ARGUMENTS, '-af', BASS]);
    expect(inputPipe).toHaveBeenCalledWith(ffmpeg);
    expect(ffmpeg.pipeCalls).toEqual([{ destination: output, options: { end: false } }]);
    expect(song.stream).toBe(output);
  });

  it('returns false when source acquisition returns nothing or rejects', async () => {
    const missing = harness();
    missing.getTrackStream.mockResolvedValueOnce(undefined);
    await expect(missing.song.setStreamTrack(track())).resolves.toBe(false);

    const failed = harness();
    failed.getTrackStream.mockRejectedValueOnce(new Error('lookup failed'));
    await expect(failed.song.setStreamTrack(track())).resolves.toBe(false);

    expect(prismMocks.ffmpegs).toHaveLength(0);
    expect(loggerMocks.warn).toHaveBeenCalledTimes(2);
  });

  it('returns false when the source cannot create a stream', async () => {
    const { song, sourceGet } = harness({ streams: [new Error('get failed')] });

    await expect(song.setStreamTrack(track())).resolves.toBe(false);

    expect(sourceGet).toHaveBeenCalledWith(undefined);
    expect(prismMocks.ffmpegs).toHaveLength(0);
  });

  it('replaces the current pipeline before destroying the prior pipeline', async () => {
    const first = new MockReadable();
    const second = new MockReadable();
    const firstSource = source(first);
    const secondSource = source(second);
    const getTrackStream = vi
      .fn()
      .mockResolvedValueOnce(firstSource.source)
      .mockResolvedValueOnce(secondSource.source);
    const song = new SongStream(0.5, 1, { getTrackStream });

    await song.setStreamTrack(track({ id: 'first' }));
    const firstFfmpeg = prismMocks.ffmpegs[0];
    await song.setStreamTrack(track({ id: 'second' }));

    expect(firstFfmpeg.unpipeCount).toBe(1);
    expect(first.destroyCount).toBe(1);
    expect(firstFfmpeg.destroyCount).toBe(1);
    expect(prismMocks.ffmpegs[1].pipeCalls[0].destination).toBe(prismMocks.volumes[0]);
  });

  it('gets and sets volume and ends only the output stream', () => {
    const { song } = harness();
    const output = prismMocks.volumes[0];

    expect(song.volume).toBe(0.5);
    song.volume = 0.8;
    expect(song.volume).toBe(0.8);
    song.end();

    expect(output.endCount).toBe(1);
    expect(output.destroyCount).toBe(0);
  });

  it('closes and clears the active source and transform without ending output', async () => {
    const input = new MockReadable();
    const { song } = harness({ streams: [input] });
    await song.setStreamTrack(track());
    const ffmpeg = prismMocks.ffmpegs[0];
    const output = prismMocks.volumes[0];

    await song.close();
    await song.close();

    expect(input.destroyCount).toBe(1);
    expect(ffmpeg.destroyCount).toBe(1);
    expect(output.endCount).toBe(0);
  });

  it('ignores an aborted source error without retrying or destroying the pipeline', async () => {
    const input = new MockReadable();
    const { song, sleep } = harness({ streams: [input] });
    const onError = vi.fn();
    song.on('error', onError);
    await song.setStreamTrack(track());

    input.emit('error', Object.assign(new Error('aborted'), { code: RequestErrorCodes.ABORTED }));

    expect(sleep.sleep).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
    expect(input.destroyCount).toBe(0);
    expect(prismMocks.ffmpegs[0].destroyCount).toBe(0);
  });

  it('retries with the prior source, emits retry, sleeps, and calculates seek time', async () => {
    const first = new MockReadable();
    const second = new MockReadable();
    const now = vi.fn().mockReturnValueOnce(10_000).mockReturnValueOnce(18_250);
    const { song, getTrackStream, sourceGet, sleep } = harness({
      streams: [first, second],
      retries: 2,
      now,
    });
    const onRetry = vi.fn();
    song.on('retry', onRetry);
    await song.setStreamTrack(track(), { nightcore: true });

    first.emit('error', new Error('network reset'));
    await waitForCall(sourceGet, 2);

    expect(onRetry).toHaveBeenCalledOnce();
    expect(sleep.sleep).toHaveBeenCalledOnce();
    expect(sourceGet).toHaveBeenNthCalledWith(2, 3250);
    expect(getTrackStream).toHaveBeenCalledOnce();
    expect(sleep.reset).toHaveBeenCalledOnce();
    expect(prismMocks.ffmpegs[1].args).toEqual([...BASE_ARGUMENTS, '-af', NIGHTCORE]);
  });

  it('clamps retry seek to zero', async () => {
    const first = new MockReadable();
    const second = new MockReadable();
    const now = vi.fn().mockReturnValueOnce(10_000).mockReturnValueOnce(12_000);
    const { song, sourceGet } = harness({ streams: [first, second], now });
    await song.setStreamTrack(track());

    first.emit('error', new Error('network reset'));
    await waitForCall(sourceGet, 2);

    expect(sourceGet).toHaveBeenNthCalledWith(2, 0);
  });

  it('does not restore a retry pipeline after the song stream is closed during sleep', async () => {
    const first = new MockReadable();
    const second = new MockReadable();
    const streamSource = source(first, second);
    let releaseSleep = () => {};
    const sleep = sleepAlgorithm();
    sleep.sleep.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          releaseSleep = () => {
            sleep.count++;
            resolve();
          };
        }),
    );
    const song = new SongStream(0.5, 1, {
      getTrackStream: vi.fn().mockResolvedValue(streamSource.source),
      sleepAlgorithm: sleep,
    });
    await song.setStreamTrack(track());

    first.emit('error', new Error('network reset'));
    expect(sleep.sleep).toHaveBeenCalledOnce();
    await song.close();
    releaseSleep();
    await Promise.resolve();
    await Promise.resolve();

    expect(streamSource.get).toHaveBeenCalledOnce();
    expect(prismMocks.ffmpegs).toHaveLength(1);
    expect(second.destroyCount).toBe(0);
  });

  it('destroys a retry stream acquired after close instead of wiring a stale pipeline', async () => {
    const first = new MockReadable();
    const staleRetry = new MockReadable();
    let resolveRetry = (_stream: Readable) => {};
    const sourceGet = vi
      .fn()
      .mockResolvedValueOnce(first)
      .mockImplementationOnce(
        () =>
          new Promise<Readable>(resolve => {
            resolveRetry = resolve;
          }),
      );
    const song = new SongStream(0.5, 1, {
      getTrackStream: vi.fn().mockResolvedValue({ get: sourceGet }),
      sleepAlgorithm: sleepAlgorithm(),
    });
    await song.setStreamTrack(track());

    first.emit('error', new Error('network reset'));
    await waitForCall(sourceGet, 2);
    await song.close();
    resolveRetry(staleRetry);
    await vi.waitFor(() => expect(staleRetry.destroyCount).toBe(1));

    expect(prismMocks.ffmpegs).toHaveLength(1);
  });

  it('reports a sleep failure without attempting another source stream', async () => {
    const input = new MockReadable();
    const streamSource = source(input);
    const sleep = sleepAlgorithm();
    const sleepError = new Error('sleep failed');
    sleep.sleep.mockRejectedValueOnce(sleepError);
    const song = new SongStream(0.5, 1, {
      getTrackStream: vi.fn().mockResolvedValue(streamSource.source),
      sleepAlgorithm: sleep,
    });
    const onError = vi.fn();
    song.on('error', onError);
    await song.setStreamTrack(track());

    input.emit('error', new Error('network reset'));
    await waitForCall(onError, 1);

    expect(onError).toHaveBeenCalledWith(sleepError);
    expect(streamSource.get).toHaveBeenCalledOnce();
  });

  it('ignores a pending sleep failure after close', async () => {
    const input = new MockReadable();
    const streamSource = source(input);
    let rejectSleep = (_error: Error) => {};
    const sleep = sleepAlgorithm();
    sleep.sleep.mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectSleep = reject;
        }),
    );
    const song = new SongStream(0.5, 1, {
      getTrackStream: vi.fn().mockResolvedValue(streamSource.source),
      sleepAlgorithm: sleep,
    });
    const onError = vi.fn();
    song.on('error', onError);
    await song.setStreamTrack(track());

    input.emit('error', new Error('network reset'));
    await song.close();
    rejectSleep(new Error('late sleep failure'));
    await Promise.resolve();
    await Promise.resolve();

    expect(onError).not.toHaveBeenCalled();
  });

  it('stops at the retry limit and cleans up the exhausted pipeline', async () => {
    const first = new MockReadable();
    const second = new MockReadable();
    const { song, sourceGet, sleep } = harness({ streams: [first, second], retries: 1 });
    const onError = vi.fn();
    song.on('error', onError);
    await song.setStreamTrack(track());

    first.emit('error', new Error('first failure'));
    await waitForCall(sourceGet, 2);
    const finalError = new Error('final failure');
    second.emit('error', finalError);

    expect(sleep.sleep).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(finalError);
    expect(second.destroyCount).toBe(1);
    expect(prismMocks.ffmpegs[1].destroyCount).toBe(1);
  });

  it('cleans up when retry source creation fails', async () => {
    const input = new MockReadable();
    const { song, sourceGet } = harness({
      streams: [input, new Error('retry get failed')],
    });
    const onError = vi.fn();
    song.on('error', onError);
    await song.setStreamTrack(track());

    input.emit('error', new Error('network reset'));
    await waitForCall(onError, 1);

    expect(sourceGet).toHaveBeenCalledTimes(2);
    expect(onError.mock.calls[0][0]).toEqual(new Error('Failed to retry stream'));
    expect(input.destroyCount).toBe(1);
    expect(prismMocks.ffmpegs[0].destroyCount).toBe(1);
  });

  it('routes FFmpeg errors through cleanup and safely logs when no error listener exists', async () => {
    const input = new MockReadable();
    const { song } = harness({ streams: [input] });
    await song.setStreamTrack(track());
    const ffmpeg = prismMocks.ffmpegs[0];
    const error = new Error('ffmpeg failed');

    expect(() => ffmpeg.emit('error', error)).not.toThrow();

    expect(input.destroyCount).toBe(1);
    expect(ffmpeg.destroyCount).toBe(1);
    expect(loggerMocks.warn).toHaveBeenCalledWith('Unhandled song stream error: %s', error);
  });

  it('cleans up before emitting FFmpeg errors to listeners', async () => {
    const { song } = harness();
    await song.setStreamTrack(track());
    const output = song.stream;
    const ffmpeg = prismMocks.ffmpegs[0];
    const onError = vi.fn(() => {
      expect(ffmpeg.destroyCount).toBe(1);
    });
    song.on('error', onError);
    const error = new Error('ffmpeg failed');

    ffmpeg.emit('error', error);

    expect(onError).toHaveBeenCalledWith(error);
    expect(output).toBe(prismMocks.volumes[0]);
  });

  it('ignores late errors and end events from a replaced pipeline', async () => {
    const first = new MockReadable();
    const second = new MockReadable();
    const firstSource = source(first);
    const secondSource = source(second);
    const song = new SongStream(0.5, 1, {
      getTrackStream: vi
        .fn()
        .mockResolvedValueOnce(firstSource.source)
        .mockResolvedValueOnce(secondSource.source),
    });
    const onError = vi.fn();
    const onEnd = vi.fn();
    song.on('error', onError);
    song.on('end', onEnd);
    await song.setStreamTrack(track({ id: 'first' }));
    const firstFfmpeg = prismMocks.ffmpegs[0];
    await song.setStreamTrack(track({ id: 'second' }));
    const secondFfmpeg = prismMocks.ffmpegs[1];

    first.emit('error', new Error('late source error'));
    firstFfmpeg.emit('error', new Error('late transform error'));
    firstFfmpeg.emit('end');

    expect(onError).not.toHaveBeenCalled();
    expect(onEnd).not.toHaveBeenCalled();
    expect(second.destroyCount).toBe(0);
    expect(secondFfmpeg.destroyCount).toBe(0);
  });

  it('emits end only for the active FFmpeg transform without closing output', async () => {
    const { song } = harness();
    const onEnd = vi.fn();
    song.on('end', onEnd);
    await song.setStreamTrack(track());

    prismMocks.ffmpegs[0].emit('end');

    expect(onEnd).toHaveBeenCalledOnce();
    expect(prismMocks.volumes[0].endCount).toBe(0);
  });
});
