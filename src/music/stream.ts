import { getTrackStream } from 'api';
import { StreamSource, Track } from 'api/@types';
import { Closable, RetrySleepAlgorithm } from 'common/@types';
import { logger } from 'common/logger';
import { RequestErrorCodes, RequestStreamError } from 'common/request';
import { ExponentialSleep } from 'common/util';
import EventEmitter from 'events';
import prism from 'prism-media';
import { PassThrough, Readable } from 'stream';

const FFMPEG_ARGUMENTS = ['-analyzeduration', '0', '-loglevel', '0', '-f', 's16le', '-ar', '48000', '-ac', '2'];
const FFMPEG_NIGHTCORE = FFMPEG_ARGUMENTS.concat(['-filter:a', 'asetrate=48000*1.25,atempo=1.06']);

export class SongStream extends EventEmitter implements Closable {

  private output = new PassThrough({ objectMode: true });
  private songStream?: Readable;
  private pcmTransform?: prism.FFmpeg;
  private track?: Track;
  private nightcore = false;
  private source?: StreamSource;
  private sleepAlg: RetrySleepAlgorithm = new ExponentialSleep();

  constructor(private readonly retries = 1) {
    super();
  }

  get stream(): Readable {
    return this.output;
  }

  async setStreamTrack(track: Track, nightcore = false, retry = false) {
    let source: StreamSource | undefined;
    if (!this.source) {
      source = await getTrackStream(track);
      this.source = source;
    } else {
      source = retry ? this.source : await getTrackStream(track);
    }
    if (!source) {
      throw new Error('Failed to get stream source!');
    }

    let stream = await source.get();
    stream = stream.once('error', this.onSongErrorHandler)
      .once('close', () => logger.debug(`Song stream closed`));

    const ffmpeg = new prism.FFmpeg({ args: !track.live && nightcore ? FFMPEG_NIGHTCORE : FFMPEG_ARGUMENTS });
    stream.pipe(ffmpeg)
        .once('error', (err: Error) => this.cleanup(err))
        .once('end', () => this.emit('end'))
        .once('close', () => logger.debug(`PCM transform closed`));

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

    this.source = source;
    this.track = track;
    this.nightcore = nightcore;
    this.songStream = stream;
    this.pcmTransform = ffmpeg;
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

  private onSongErrorHandler = (err: RequestStreamError) => {
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
  }

  private async retryStream(): Promise<void> {
    try {
      await this.sleepAlg.sleep();
      await this.setStreamTrack(this.track!, this.nightcore, true);
    } catch (e: any) {
      this.cleanup(e);
    }
  }

}