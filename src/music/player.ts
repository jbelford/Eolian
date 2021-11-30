import { AudioPlayer, AudioPlayerStatus, createAudioPlayer, createAudioResource, NoSubscriberBehavior, StreamType } from '@discordjs/voice';
import { DEFAULT_VOLUME, IDLE_TIMEOUT_MINS } from 'common/constants';
import { logger } from 'common/logger';
import { ServerQueue } from 'data/@types';
import EventEmitter from 'events';
import { DiscordVoiceConnection } from 'framework';
import { ContextClient, ContextVoiceChannel } from 'framework/@types';
import { Player } from 'music/@types';
import prism, { VolumeTransformer } from 'prism-media';
import { PassThrough, Readable, Transform } from 'stream';
import { SongStream } from './stream';

const OPUS_OPTIONS = { rate: 48000, channels: 2, frameSize: 960 };
const PLAYER_TIMEOUT = 1000 * 60 * 3;
const PLAYER_RETRIES = 2;

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
  private songStream: SongStream | null = null;
  private volumeTransform: VolumeTransformer | null = null;
  private opusStream: Transform | null = null;
  private inputStream: PassThrough | null = null;
  private audioPlayer: AudioPlayer | null = null;

  private _isStreaming = false;
  private _nightcore = false;
  private _paused = false;

  constructor(
    private readonly client: ContextClient,
    readonly queue: ServerQueue,
    private _volume = DEFAULT_VOLUME) {
    super();
  }

  private cleanup = () => {
    if (this.timeoutCheck) {
      clearInterval(this.timeoutCheck);
      this.timeoutCheck = null;
    }
    this.songStream?.cleanup();
    this.volumeTransform?.destroy();
    this.opusStream?.destroy();
    this.audioPlayer?.stop();
    this.client.getVoice()?.disconnect();
    this.inputStream = null;
    this.songStream = null;
    this.volumeTransform = null;
    this.opusStream = null;
    this.audioPlayer = null;
    this._isStreaming = false;
    this._paused = false;
    this.emitDone();
  }

  get isStreaming(): boolean {
    return this._isStreaming;
  }

  get paused(): boolean {
    return this.isStreaming && this._paused;
  }

  get volume(): number {
    return this._volume;
  }

  get nightcore(): boolean {
    return this._nightcore;
  }

  get idle(): boolean {
    return (!this.isStreaming || this._paused) && Date.now() - this.lastUsed >= IDLE_TIMEOUT_MINS * 1000;
  }

  getChannel(): ContextVoiceChannel | undefined {
    const voice = this.client.getVoice();
    return voice && voice.getChannel();
  }

  async close(): Promise<void> {
    this.stop();
  }

  setVolume(value: number): void {
    this.lastUsed = Date.now();
    this._volume = Math.max(0, Math.min(1, value));
    if (this.volumeTransform) {
      this.volumeTransform.setVolume(this._volume);
    }
    this.emitUpdate();
  }

  setNightcore(on: boolean): void {
    this._nightcore = on;
  }

  async play(): Promise<void> {
    if (this.isStreaming) {
      return;
    }
    this._isStreaming = true;

    try {
      const connection = this.client.getVoice() as DiscordVoiceConnection | undefined;
      if (!connection) {
        throw new Error('No voice connection!');
      }
      connection.onDisconnect(() => {
        this.cleanup();
      });

      const input = await this.startNewStream();

      this.timeoutCheck = setInterval(this.timeoutCheckHandler, PLAYER_TIMEOUT);

      const resource = createAudioResource(input, {
        inputType: StreamType.Opus,
        inlineVolume: false,
      });
      this.audioPlayer = createAudioPlayer({
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Pause
        }
      });

      this.audioPlayer.play(resource);
      this.audioPlayer.once('error', this.streamErrorHandler);
      this.audioPlayer.on(AudioPlayerStatus.Playing, () => {
        this._paused = false;
      });
      this.audioPlayer.on(AudioPlayerStatus.Paused, () => {
        this._paused = true;
      });
      this.audioPlayer.once(AudioPlayerStatus.Idle, () => {
        this.stop()
      });

      if (!connection.subscribe(this.audioPlayer)) {
        throw new Error('Failed to subscribe!');
      }
    } catch (e: any) {
      this.streamErrorHandler(e);
    }
  }

  async skip(): Promise<void> {
    if (this.isStreaming) {
      const size = await this.queue.size(true);
      if (size > 0) {
        await this.startNewStream().catch(this.streamErrorHandler);
      } else {
        this.stop();
      }
    }
  }

  stop(): void {
    this.cleanup();
  }

  async pause(): Promise<void> {
    if (this.isStreaming && !this.paused) {
      this.lastUsed = Date.now();
      this.audioPlayer!.pause(true);
      this.emitUpdate();
    }
  }

  async resume(): Promise<void> {
    if (this.isStreaming && this.paused) {
      this.lastUsed = Date.now();
      this.audioPlayer!.unpause();
      this.emitUpdate();
    }
  }

  private async getNextStream(): Promise<Readable | null> {
    try {
      this.songStream?.cleanup();
      this.songStream = null;
      const nextTrack = await this.queue.peek();
      if (nextTrack) {
        this.songStream = new SongStream(nextTrack, this.nightcore, PLAYER_RETRIES);
        this.songStream.once('error', this.streamErrorHandler);
        this.songStream.on('retry', this.onRetryHandler);
        return await this.songStream.createStream();
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
    if (!this.getChannel()?.hasPeopleListening()) {
      this.emitIdle();
      this.stop();
    }
  };

  private streamEndHandler = async () => {
    try {
        if (this.songStream?.stream) {
          this.songStream.stream.unpipe(this.volumeTransform!);
        }
        if (this.getChannel()?.hasPeopleListening()) {
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
    } catch (e: any) {
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

  private emitUpdate() {
    return this.emit('update');
  }

  private streamErrorHandler = (err: Error) => {
    logger.warn(`Cleanup stream due to error: %s`, err);
    this.stop();
    this.emitError();
  }

}
