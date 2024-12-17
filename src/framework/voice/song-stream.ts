import { getTrackStream } from '@eolian/api';
import { Track, StreamSource } from '@eolian/api/@types';
import { Closable, RetrySleepAlgorithm } from '@eolian/common/@types';
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

type StreamOptions = {
  nightcore?: boolean;
  bass?: boolean;
};

export class SongStream extends EventEmitter implements Closable {
  private output: prism.VolumeTransformer;
  private songStream?: Readable;
  private pcmTransform?: prism.FFmpeg;
  private track?: Track;
  private options?: StreamOptions;
  private source?: StreamSource;
  private sleepAlg: RetrySleepAlgorithm = new ExponentialSleep();
  private start?: number;

  constructor(
    volume: number,
    private readonly retries = 1,
  ) {
    super();
    this.output = new prism.VolumeTransformer({ type: 's16le', volume: volume });
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
  ): Promise<boolean> {
    let source: StreamSource | undefined;
    if (!this.source) {
      source = await getTrackStream(track);
      this.source = source;
    } else {
      source = retry ? this.source : await getTrackStream(track);
    }
    if (!source) {
      logger.warn('Failed to get stream source!');
      return false;
    }

    let stream: Readable;
    try {
      stream = await source.get(seek);
    } catch (e) {
      logger.warn('Failed to get create stream!\n%s', e);
      return false;
    }

    stream = stream
      .once('error', this.onSongErrorHandler)
      .once('close', () => logger.debug(`Song stream closed`));

    const ffmpeg = this.createFfmpeg(track.live, options);
    stream
      .pipe(ffmpeg)
      .once('error', (err: Error) => this.cleanup(err))
      .once('end', () => this.emit('end'));

    if (this.pcmTransform) {
      this.pcmTransform.unpipe(this.output);
      ffmpeg.pipe(this.output, { end: false });
      this.songStream?.destroy();
      this.pcmTransform.destroy();
    } else {
      ffmpeg.pipe(this.output, { end: false });
    }

    if (!retry) {
      this.sleepAlg.reset();
    }

    this.start = Date.now();
    this.source = source;
    this.track = track;
    this.options = options;
    this.songStream = stream;
    this.pcmTransform = ffmpeg;

    return true;
  }

  private createFfmpeg(isLive?: boolean, options?: StreamOptions) {
    const filters: string[] = [];
    if (!isLive && options) {
      if (options.nightcore) {
        filters.push(FFMPEG_NIGHTCORE_FILTERS);
      }
      if (options.bass) {
        filters.push(FFMPEG_BASS_BOOSTED_FILTERS);
      }
    }

    const args = filters.length
      ? FFMPEG_ARGUMENTS.concat(['-af', filters.join(', ')])
      : FFMPEG_ARGUMENTS;
    return new prism.FFmpeg({ args });
  }

  end() {
    this.output.end();
  }

  async close(): Promise<void> {
    this.cleanup();
  }

  private cleanup(err?: Error): void {
    if (err) {
      this.emit('error', err);
    }
    this.songStream?.destroy();
    this.pcmTransform?.destroy();
    this.songStream = undefined;
    this.pcmTransform = undefined;
  }

  private onSongErrorHandler = (err: HttpRequestStreamError) => {
    if (err.code === RequestErrorCodes.ABORTED) {
      return;
    }
    if (this.sleepAlg.count < this.retries) {
      logger.warn('Retry after song stream error: %s', err.message);
      this.retryStream();
      this.emit('retry');
    } else {
      this.cleanup(err);
    }
  };

  private async retryStream(): Promise<void> {
    try {
      await this.sleepAlg.sleep();
      const seek = this.start && Math.max(0, Date.now() - this.start - 5000);
      const success = await this.setStreamTrack(this.track!, this.options, true, seek);
      if (!success) {
        throw new Error('Failed to retry stream');
      }
    } catch (e: any) {
      this.cleanup(e);
    }
  }
}
