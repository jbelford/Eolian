import { getTrackStream } from 'api';
import { logger } from 'common/logger';
import { ServerQueue } from 'data/@types';
import { Client, VoiceConnection } from 'discord.js';
import EventEmitter from 'events';
import { Player, StreamData } from 'music/@types';
import prism, { VolumeTransformer } from 'prism-media';
import { PassThrough } from 'stream';


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

export class DiscordPlayer extends EventEmitter implements Player {

  private _volume: number = 0.5;
  private stream?: StreamData;
  private volumeTransform?: VolumeTransformer;

  constructor(
    readonly connectionProvider: VoiceConnectionProvider,
    readonly queue: ServerQueue) {
    super();
  }

  get isStreaming() {
    return !!this.stream && this.connectionProvider.has();
  }

  get paused() {
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

    const connection = this.getConnection();

    this.stream = await this.getNextStream();
    if (!this.stream) {
      throw Error('Failed to get first stream!');
    }
    await this.popNext();


    const passthrough = new PassThrough();

    const endHandler = async () => {
      try {
        this.stream = await this.getNextStream();
        if (this.stream) {
          this.stream.readable.pipe(passthrough, { end: false });
          this.stream.readable.once('end', endHandler);
        } else {
          passthrough.end();
        }
        await this.popNext();
      } catch (e) {
        logger.warn(e);
        passthrough.end();
      }
    };

    this.stream.readable.pipe(passthrough, { end: false });
    this.stream.readable.once('end', endHandler);

    this.volumeTransform = new prism.VolumeTransformer({ type: 's16le', volume: this._volume });
    const opusStream = passthrough.pipe(this.volumeTransform)
      .pipe(new prism.opus.Encoder(OPUS_OPTIONS));

    // We manage volume directly so set false
    connection.play(opusStream, { seek: 0, volume: false, type: 'opus' });

    const disconnectHandler = () => this.emitDone();
    connection.once('disconnect', disconnectHandler);

    connection.dispatcher.on('error', err => logger.warn(err));

    connection.dispatcher.once('close', () => {
      if (this.stream && !this.stream.readable.destroyed) {
        this.stream.readable.destroy();
      }
      this.stream = undefined;
      this.volumeTransform = undefined;
    });

    connection.dispatcher.once('finish', async () => {
      if (this.stream && !this.stream.readable.destroyed) {
        this.stream.readable.destroy();
      }
      this.stream = undefined;

      // Start stream again if there are still items in the queue
      if (await this.queue.peek()) {
        connection.removeListener('disconnect', disconnectHandler);
        await this.play();
        return;
      }

      if (this.connectionProvider.has()) {
        this.getConnection().disconnect();
      }
    });
  }

  async skip(): Promise<void> {
    if (this.isStreaming) {
      this.getConnection().dispatcher.end();
    }
  }

  async stop(): Promise<void> {
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

  private async getNextStream(): Promise<StreamData | undefined> {
    const nextTrack = await this.queue.peek();
    if (nextTrack) {
      const stream = await getTrackStream(nextTrack);
      if (stream) {
        const pcmTransform = stream.opus ? new prism.opus.Decoder(OPUS_OPTIONS) : new prism.FFmpeg({ args: FFMPEG_ARGUMENTS });
        stream.readable = stream.readable.pipe(pcmTransform);
        return stream;
      }
    }
    return undefined;
  }

  private async popNext(): Promise<void> {
    const track = await this.queue.pop();
    this.emit('next', track);
  }

  private emitDone() {
    this.emit('done');
    this.removeAllListeners();
  }
}
