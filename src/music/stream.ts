import { getTrackStream } from 'api';
import { StreamSource, Track } from 'api/@types';
import { logger } from 'common/logger';
import EventEmitter from 'events';
import prism from 'prism-media';
import { Duplex, PassThrough, Readable } from 'stream';

const FFMPEG_ARGUMENTS = ['-analyzeduration', '0', '-loglevel', '0', '-f', 's16le', '-ar', '48000', '-ac', '2'];
const FFMPEG_NIGHTCORE = FFMPEG_ARGUMENTS.concat(['-filter:a', 'asetrate=48000*1.25,atempo=1.06']);

export class SongStream extends EventEmitter {

  private songStream?: Readable;
  private pcmTransform?: Duplex;
  private output = new PassThrough();
  private source?: StreamSource;
  private startTime = 0;
  private attempts = 0;

  constructor(private readonly track: Track,
      private readonly nightcore: boolean,
      private readonly retries = 1) {
    super();
  }

  get stream(): Readable | undefined {
    return this.output;
  }

  async getStream(): Promise<Readable> {
    this.attempts = 0;
    this.startTime = Date.now();
    const stream = await this.createSongStream();
    return stream.pipe(this.output);
  }

  private async createSongStream(): Promise<Readable> {
    let seek: number | undefined;
    if (this.startTime > 0) {
      seek = Math.min(0, Date.now() - this.startTime);
    }

    if (!this.source) {
      this.source = await getTrackStream(this.track);
      if (!this.source) {
        throw new Error('Failed to get stream source!');
      }
    }

    const stream = await this.source.get(seek);
    if (!this.stream) {
      throw new Error('Failed to get stream!');
    }

    this.songStream = stream
      .once('error', this.onSongErrorHandler)
      .once('close', () => logger.debug(`Song stream closed`));

    const ffmpeg = new prism.FFmpeg({ args: !this.track.live && this.nightcore ? FFMPEG_NIGHTCORE : FFMPEG_ARGUMENTS });
    this.pcmTransform = this.songStream.pipe(ffmpeg)
        .once('error', (err: Error) => this.cleanup(err))
        .once('close', () => logger.debug(`PCM transform closed`));

    return this.pcmTransform;
  }

  cleanup(err?: Error): void {
    if (err) {
      this.emit('error', err);
    }
    this.songStream?.destroy();
    this.pcmTransform?.destroy();
    this.output.destroy();
    this.songStream = undefined;
    this.pcmTransform = undefined;
  }

  private onSongErrorHandler = (err: Error) => {
    if (this.attempts < this.retries) {
      logger.warn('Retry after song stream error: %s', err);
      this.pcmTransform?.unpipe(this.output);
      this.pcmTransform?.destroy();
      this.songStream?.destroy();
      this.pcmTransform = undefined;
      this.songStream = undefined;
      this.attempts++;
      this.retryStream();
      this.emit('retry');
    } else {
      this.cleanup(err);
    }
  }

  private async retryStream(): Promise<void> {
    try {
      const stream = await this.createSongStream();
      if (!stream) {
        throw new Error('PCM Transform is missing!');
      }
      stream.pipe(this.output);
    } catch (e) {
      this.cleanup(e);
    }
  }

}