import { DEFAULT_VOLUME, IDLE_TIMEOUT } from 'common/constants';
import { logger } from 'common/logger';
import { ServerQueue } from 'data/@types';
import { Client, StreamDispatcher, VoiceConnection } from 'discord.js';
import EventEmitter from 'events';
import { Player } from 'music/@types';
import prism, { VolumeTransformer } from 'prism-media';
import { PassThrough, Readable, Transform } from 'stream';
import { SongStream } from './stream';

export class DiscordVoiceConnectionProvider {

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

const OPUS_OPTIONS = { rate: 48000, channels: 2, frameSize: 960 };
const PLAYER_TIMEOUT = 1000 * 60 * 3;

/**
 *
 * Stream pipeline:
 *
 *   ----------------------- Replace all of these when force skipped ----------------------
 *  |                                                                                     |
 *  Song readable stream -> PCM transformer (ffmpeg) -> Volume Transform -> Opus Encoder -> Passthrough -> Dispatcher
 * |                                                 |
 * ------- Replace these 2 when song ends -----------
 *
 */
export class DiscordPlayer extends EventEmitter implements Player {

  private lastUsed = Date.now();
  private timeoutCheck: NodeJS.Timeout | null = null;
  private streamFetcher: SongStream | null = null;
  private volumeTransform: VolumeTransformer | null = null;
  private opusStream: Transform | null = null;
  private inputStream: PassThrough | null = null;
  private dispatcher: StreamDispatcher | null = null;
  private _nightcore = false;

  constructor(
    readonly connectionProvider: DiscordVoiceConnectionProvider,
    readonly queue: ServerQueue,
    private _volume = DEFAULT_VOLUME) {
    super();
  }

  private cleanup = (err?: Error) => {
    if (err) {
      logger.warn(`Cleanup stream due to error: %s`, err);
      this.emitError();
    }

    if (this.timeoutCheck) {
      clearInterval(this.timeoutCheck);
      this.timeoutCheck = null;
    }
    this.streamFetcher?.cleanup();
    this.volumeTransform?.destroy();
    this.opusStream?.destroy();
    this.dispatcher?.destroy();
    this.inputStream = null;
    this.streamFetcher = null;
    this.volumeTransform = null;
    this.opusStream = null;
    this.dispatcher = null;
  }

  get isStreaming(): boolean {
    return !!this.dispatcher;
  }

  get paused(): boolean {
    return this.isStreaming && !!this.dispatcher?.paused;
  }

  get volume(): number {
    return this._volume;
  }

  get nightcore(): boolean {
    return this._nightcore;
  }

  get idle(): boolean {
    return (!this.isStreaming || !!this.dispatcher?.paused) && Date.now() - this.lastUsed >= IDLE_TIMEOUT * 1000;
  }

  async close(): Promise<void> {
    this.removeAllListeners();
    await this.stop();
  }

  setVolume(value: number): void {
    this.lastUsed = Date.now();
    this._volume = Math.max(0, Math.min(1, value));
    if (this.volumeTransform) {
      this.volumeTransform.setVolume(this._volume);
    }
    this.emitVolume();
  }

  setNightcore(on: boolean): void {
    this._nightcore = on;
  }

  async play(): Promise<void> {
    if (this.isStreaming) {
      return;
    }

    try {
      const connection = this.connectionProvider.get();
      if (!connection) {
        throw new Error('No voice connection!');
      }
      connection.once('disconnect', this.disconnectHandler);

      const input = await this.startNewStream();

      this.timeoutCheck = setInterval(this.timeoutCheckHandler, PLAYER_TIMEOUT);

      // We manage volume directly so set false
      this.dispatcher = connection.play(input, { seek: 0, volume: false, type: 'opus' });
      this.dispatcher.once('error', this.streamErrorHandler);
      this.dispatcher.once('close', this.cleanup);
      this.dispatcher.once('finish', () => {
        this.connectionProvider.get()?.disconnect();
      });
    } catch (e) {
      this.streamErrorHandler(e);
      this.connectionProvider.get()?.disconnect();
    }
  }

  async skip(): Promise<void> {
    if (this.isStreaming) {
      if (await this.queue.peek()) {
        await this.startNewStream().catch(this.streamErrorHandler);
      } else {
        await this.stop();
      }
    }
  }

  async stop(): Promise<void> {
    this.connectionProvider.get()?.disconnect();
  }

  async pause(): Promise<void> {
    if (this.isStreaming && !this.paused) {
      this.lastUsed = Date.now();
      this.dispatcher!.pause(true);
    }
  }

  async resume(): Promise<void> {
    if (this.isStreaming && this.paused) {
      this.lastUsed = Date.now();
      this.dispatcher!.resume();
    }
  }

  private async getNextStream(): Promise<Readable | null> {
    try {
      this.streamFetcher?.cleanup();
      this.streamFetcher = null;
      const nextTrack = await this.queue.peek();
      if (nextTrack) {
        this.streamFetcher = new SongStream(nextTrack, this.nightcore);
        this.streamFetcher.once('error', this.streamErrorHandler);
        this.streamFetcher.on('retry', this.onRetryHandler);
        return await this.streamFetcher.getStream();
      }
    } catch (e) {
      logger.warn('Error occured getting next stream: %s', e);
    }
    return null;
  }

  private async startNewStream(): Promise<Readable> {
    if (!this.inputStream) {
      this.inputStream = new PassThrough()
        .once('error', this.streamErrorHandler)
        .once('close', () => logger.debug('Passthrough input closed'))
    } else if (this.opusStream) {
      this.opusStream.unpipe(this.inputStream);
    } else {
      throw new Error('Input and output are missing!');
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

  private timeoutCheckHandler = () => {
    if (!this.hasPeopleListening()) {
      this.emitIdle();
      this.stop();
    }
  };

  private hasPeopleListening(): boolean {
    return !!this.connectionProvider.get()?.channel.members.find(member => !member.user.bot && !member.voice.deaf);
  }

  private streamEndHandler = async () => {
    try {
        if (this.streamFetcher?.stream) {
          this.streamFetcher.stream.unpipe(this.volumeTransform!);
        }
        if (this.hasPeopleListening()) {
          const readable = await this.getNextStream();
          if (readable) {
            readable.once('end', this.streamEndHandler)
              .pipe(this.volumeTransform!, { end: false });
            await this.popNext();
            return;
          }
        } else {
          this.emitIdle();
        }
        this.opusStream?.once('end', () => this.inputStream?.end());
        this.volumeTransform!.end();
    } catch (e) {
      this.streamErrorHandler(e);
    }
  };

  private onRetryHandler = () => {
    this.emit('retry');
  };

  private async popNext(): Promise<void> {
    this.lastUsed = Date.now();
    const track = await this.queue.pop();
    this.emit('next', track);
  }

  private emitDone() {
    this.emit('done');
  }

  private emitIdle() {
    this.emit('idle');
  }

  private emitError() {
    this.emit('error');
  }

  private emitVolume() {
    return this.emit('volume');
  }

  private streamErrorHandler = (err: Error) => this.cleanup(err);
  private disconnectHandler = () => this.emitDone();
}
