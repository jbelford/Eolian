import { getTrackStream } from 'api';
import { logger } from 'common/logger';
import { ServerQueue } from 'data/@types';
import { Client, VoiceConnection } from 'discord.js';
import EventEmitter from 'events';
import { Player } from 'music/@types';
import prism, { VolumeTransformer } from 'prism-media';
import { Duplex, PassThrough, Readable, Transform } from 'stream';


export class VoiceConnectionProvider {

  constructor(
    private readonly client: Client,
    private readonly guildId: string) {
  }

  has(): boolean {
    return this.client.voice!.connections.has(this.guildId);
  }

  get(): VoiceConnection | undefined {
    return this.client.voice!.connections.get(this.guildId);
  }

}

const FFMPEG_ARGUMENTS = ['-analyzeduration', '0', '-loglevel', '0', '-f', 's16le', '-ar', '48000', '-ac', '2'];
const OPUS_OPTIONS = { rate: 48000, channels: 2, frameSize: 960 };

/**
 *
 * Stream pipeline:
 *
 *   ------------------------------------- Replace all of these when force skipped -----------------------------
 *  |                                                                                                          |
 *  Song readable stream -> PCM transformer (either opus decoder / ffmpeg) -> Volume Transform -> Opus Encoder -> Passthrough -> Dispatcher
 * |                                                                     |
 * ------------- Replace these 2 when song ends -------------------------
 *
 */
export class DiscordPlayer extends EventEmitter implements Player {

  private _volume = 0.10;
  private songStream: Readable | null = null;
  private pcmTransform: Duplex | null = null;
  private volumeTransform: VolumeTransformer | null = null;
  private opusStream: Transform | null = null;
  private inputStream: PassThrough | null = null;

  constructor(
    readonly connectionProvider: VoiceConnectionProvider,
    readonly queue: ServerQueue) {
    super();
  }

  private cleanup = (err?: Error) => {
    if (err) {
      logger.warn(`Cleanup stream due to error: ${err}`);
    }

    this.songStream?.destroy(err);
    this.pcmTransform?.destroy(err);
    this.volumeTransform?.destroy(err);
    this.opusStream?.destroy(err);
    this.connectionProvider.get()?.dispatcher?.destroy(err);
    this.inputStream = null;
    this.songStream = null;
    this.pcmTransform = null;
    this.volumeTransform = null;
    this.opusStream = null;
  }

  get isStreaming(): boolean {
    return !!this.songStream && this.connectionProvider.has();
  }

  get paused(): boolean {
    return this.isStreaming && this.getConnection().dispatcher.paused;
  }

  get volume(): number {
    return this._volume;
  }

  setVolume(value: number): void {
    this._volume = Math.max(0, Math.min(1, value));
    if (this.volumeTransform) {
      this.volumeTransform.setVolume(this._volume);
    }
  }

  async play(): Promise<void> {
    if (this.isStreaming) {
      return;
    }

    try {
      const connection = this.getConnection();
      const input = await this.startNewStream();

      // We manage volume directly so set false
      connection.play(input, { seek: 0, volume: false, type: 'opus' });
      connection.once('disconnect', this.disconnectHandler);
      connection.dispatcher.on('error', this.streamErrorHandler);
      connection.dispatcher.once('close', this.cleanup);
      connection.dispatcher.on('finish', () => {
        if (this.connectionProvider.has()) {
          this.getConnection().disconnect();
        }
      });
    } catch (e) {
      this.streamErrorHandler(e);
    }
  }

  async skip(): Promise<void> {
    if (this.isStreaming) {
      if (await this.queue.peek()) {
        await this.startNewStream().catch(this.streamErrorHandler);
      }
    }
  }

  async stop(): Promise<void> {
    if (this.isStreaming) {
      this.getConnection().disconnect();
    }
  }

  async pause(): Promise<void> {
    if (this.isStreaming) {
      this.getConnection().dispatcher.pause();
    }
  }

  async resume(): Promise<void> {
    if (this.isStreaming) {
      this.getConnection().dispatcher.resume();
    }
  }

  private getConnection(): VoiceConnection {
    const connection = this.connectionProvider.get();
    if (!connection) {
      throw new Error('Expected voice connection to be available');
    }
    return connection;
  }

  private async getNextStream(): Promise<Readable | null> {
    this.songStream?.destroy();
    this.pcmTransform?.destroy();
    this.songStream = null;
    this.pcmTransform = null;

    const nextTrack = await this.queue.peek();
    if (nextTrack) {
      const stream = await getTrackStream(nextTrack);
      if (stream) {
        this.songStream = stream.readable;
        this.pcmTransform = stream.opus ? new prism.opus.Decoder(OPUS_OPTIONS) : new prism.FFmpeg({ args: FFMPEG_ARGUMENTS });
        return this.songStream
            .once('error', this.streamErrorHandler)
            .once('close', () => logger.debug(`Song stream closed`))
          .pipe(this.pcmTransform)
            .once('error', this.streamErrorHandler)
            .once('close', () => logger.debug(`PCM transform closed`));
      }
    }
    return null;
  }

  private async startNewStream(): Promise<Readable> {
    if (!this.inputStream) {
      this.inputStream = new PassThrough()
        .once('error', this.streamErrorHandler)
        .once('close', () => logger.debug('Passthrough input closed'));
    }

    const readable = await this.getNextStream();
    if (!readable) {
      throw new Error('Missing next stream!');
    }
    await this.popNext();

    this.volumeTransform?.destroy();
    this.opusStream?.destroy();
    this.volumeTransform = null;
    this.opusStream = null;

    this.volumeTransform = new prism.VolumeTransformer({ type: 's16le', volume: this._volume });
    this.opusStream = new prism.opus.Encoder(OPUS_OPTIONS);

    return readable.once('end', this.streamEndHandler)
      .pipe(this.volumeTransform, { end: false })
        .once('error', this.streamErrorHandler)
        .once('close', () => logger.debug('Volume transform closed'))
      .pipe(this.opusStream)
        .once('error', this.streamErrorHandler)
        .once('close', () => logger.debug('Opus encoder closed'))
      .pipe(this.inputStream, { end: false });
  }

  private streamEndHandler = async () => {
    try {
        const readable = await this.getNextStream();
        if (readable) {
          readable.once('end', this.streamEndHandler)
            .pipe(this.volumeTransform!, { end: false });
        } else {
          this.volumeTransform!.destroy();
          this.volumeTransform = null;
        }
        await this.popNext();
    } catch (e) {
      this.streamErrorHandler(e);
    }
  };

  private async popNext(): Promise<void> {
    const track = await this.queue.pop();
    this.emit('next', track);
  }

  private emitDone() {
    this.emit('done');
  }

  private streamErrorHandler = (err: Error) => this.cleanup(err);
  private disconnectHandler = () => this.emitDone();
}
