import { getTrackStream } from '@eolian/api';
import { Track, StreamSource } from '@eolian/api/@types';
import { Closable, ProgressUpdater, RetrySleepAlgorithm } from '@eolian/common/@types';
import { logger } from '@eolian/common/logger';
import { ExponentialSleep } from '@eolian/common/util';
import { RequestErrorCodes } from '@eolian/http';
import { HttpRequestStreamError } from '@eolian/http/@types';
import EventEmitter from 'events';
import prism from 'prism-media';
import { Readable } from 'node:stream';

const FFMPEG_ARGUMENTS = [
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

const FFMPEG_NIGHTCORE_FILTERS = 'asetrate=48000*1.25,atempo=1.06';
const FFMPEG_BASS_BOOSTED_FILTERS = 'equalizer=f=150:width_type=h:width=100:g=15';

export type StreamOptions = {
  nightcore?: boolean;
  bass?: boolean;
};

export type SongStreamDependencies = {
  getTrackStream: typeof getTrackStream;
  createFfmpeg: (args: string[]) => prism.FFmpeg;
  createVolumeTransformer: (volume: number) => prism.VolumeTransformer;
  sleepAlgorithm: RetrySleepAlgorithm;
  now: () => number;
};

export function buildFfmpegArguments(isLive?: boolean, options?: StreamOptions): string[] {
  const filters: string[] = [];
  if (!isLive && options) {
    if (options.nightcore) {
      filters.push(FFMPEG_NIGHTCORE_FILTERS);
    }
    if (options.bass) {
      filters.push(FFMPEG_BASS_BOOSTED_FILTERS);
    }
  }

  return filters.length
    ? FFMPEG_ARGUMENTS.concat(['-af', filters.join(', ')])
    : [...FFMPEG_ARGUMENTS];
}

export class SongStream extends EventEmitter implements Closable {
  private output: prism.VolumeTransformer;
  private songStream?: Readable;
  private pcmTransform?: prism.FFmpeg;
  private track?: Track;
  private options?: StreamOptions;
  private source?: StreamSource;
  private start?: number;
  private generation = 0;
  private readonly dependencies: SongStreamDependencies;

  constructor(
    volume: number,
    private readonly retries = 1,
    dependencies: Partial<SongStreamDependencies> = {},
  ) {
    super();
    this.dependencies = {
      getTrackStream,
      createFfmpeg: args => new prism.FFmpeg({ args }),
      createVolumeTransformer: initialVolume =>
        new prism.VolumeTransformer({ type: 's16le', volume: initialVolume }),
      sleepAlgorithm: new ExponentialSleep(),
      now: Date.now,
      ...dependencies,
    };
    this.output = this.dependencies.createVolumeTransformer(volume);
    this.output.on('close', () => logger.debug(`Song output closed`));
  }

  get stream(): Readable {
    return this.output;
  }

  get volume(): number {
    return this.output.volume;
  }

  set volume(v: number) {
    this.output.setVolume(v);
  }

  async setStreamTrack(
    track: Track,
    options?: StreamOptions,
    retry = false,
    seek?: number,
    progress?: ProgressUpdater<string>,
  ): Promise<boolean> {
    return this.setStreamTrackInternal(
      track,
      options,
      retry,
      seek,
      progress,
      retry ? this.generation : undefined,
    );
  }

  private async setStreamTrackInternal(
    track: Track,
    options: StreamOptions | undefined,
    retry: boolean,
    seek: number | undefined,
    progress: ProgressUpdater<string> | undefined,
    expectedGeneration: number | undefined,
  ): Promise<boolean> {
    let source: StreamSource | undefined;
    try {
      source =
        retry && this.source
          ? this.source
          : await this.dependencies.getTrackStream(track, progress);
    } catch (e) {
      logger.warn('Failed to get stream source!\n%s', e);
      return false;
    }
    if (!source) {
      logger.warn('Failed to get stream source!');
      return false;
    }

    let stream: Readable;
    try {
      stream = await source.get(seek);
    } catch (e) {
      logger.warn('Failed to create stream!\n%s', e);
      return false;
    }

    if (expectedGeneration !== undefined && this.generation !== expectedGeneration) {
      stream.destroy();
      return false;
    }

    const ffmpeg = this.dependencies.createFfmpeg(buildFfmpegArguments(track.live, options));
    const previousSongStream = this.songStream;
    const previousPcmTransform = this.pcmTransform;

    stream.once('error', (err: HttpRequestStreamError) => this.onSongError(stream, err));
    stream.once('close', () => logger.debug(`Song stream closed`));
    ffmpeg.once('error', (err: Error) => {
      if (this.pcmTransform === ffmpeg) {
        this.cleanup(err);
      }
    });
    ffmpeg.once('end', () => {
      if (this.pcmTransform === ffmpeg) {
        this.emit('end');
      }
    });

    if (!retry) {
      this.dependencies.sleepAlgorithm.reset();
    }

    previousPcmTransform?.unpipe(this.output);
    this.start = this.dependencies.now();
    this.source = source;
    this.track = track;
    this.options = options;
    this.songStream = stream;
    this.pcmTransform = ffmpeg;
    this.generation++;

    stream.pipe(ffmpeg);
    ffmpeg.pipe(this.output, { end: false });
    previousSongStream?.destroy();
    previousPcmTransform?.destroy();

    return true;
  }

  end() {
    this.output.end();
  }

  async close(): Promise<void> {
    this.generation++;
    this.cleanup();
  }

  private cleanup(err?: Error): void {
    const songStream = this.songStream;
    const pcmTransform = this.pcmTransform;
    this.songStream = undefined;
    this.pcmTransform = undefined;
    songStream?.destroy();
    pcmTransform?.destroy();

    if (err) {
      if (this.listenerCount('error')) {
        this.emit('error', err);
      } else {
        logger.warn('Unhandled song stream error: %s', err);
      }
    }
  }

  private onSongError(stream: Readable, err: HttpRequestStreamError): void {
    if (this.songStream !== stream) {
      return;
    }
    if (err.code === RequestErrorCodes.ABORTED) {
      return;
    }
    if (this.dependencies.sleepAlgorithm.count < this.retries) {
      logger.warn('Retry after song stream error: %s', err.message);
      const generation = this.generation;
      this.cleanup();
      void this.retryStream(generation);
      this.emit('retry');
    } else {
      this.cleanup(err);
    }
  }

  private async retryStream(generation: number): Promise<void> {
    try {
      await this.dependencies.sleepAlgorithm.sleep();
      if (this.generation !== generation) {
        return;
      }
      const seek = this.start && Math.max(0, this.dependencies.now() - this.start - 5000);
      const success = await this.setStreamTrackInternal(
        this.track!,
        this.options,
        true,
        seek,
        undefined,
        generation,
      );
      if (!success) {
        if (this.generation !== generation) {
          return;
        }
        throw new Error('Failed to retry stream');
      }
    } catch (e: any) {
      if (this.generation === generation) {
        this.cleanup(e);
      }
    }
  }
}
