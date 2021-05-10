import { getTrackStream } from 'api';
import { QueueStream } from 'common/qstream';
import { Client, VoiceChannel, VoiceConnection } from 'discord.js';
import EventEmitter from 'events';
import { Player, StreamData } from 'music/@types';
import { ContextQueue, ContextVoiceChannel, ContextVoiceConnection } from './@types';


export class DiscordVoiceChannel implements ContextVoiceChannel {

  constructor(private readonly channel: VoiceChannel) {
  }

  get id(): string {
    return this.channel.id;
  }

  async join(): Promise<void> {
    await this.channel.join();
  }

}

export class DiscordVoiceConnection implements ContextVoiceConnection {

  constructor(private readonly connection: VoiceConnection, readonly player: Player) {
  }

  get channelId(): string {
    return this.connection.channel.id;
  }

  async disconnect(): Promise<void> {
    this.connection.disconnect();
  }

}

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

export class DiscordPlayer extends EventEmitter implements Player {

  private volume: number = 0.5;
  private stream?: QueueStream;

  constructor(
    private connectionProvider: VoiceConnectionProvider,
    private readonly queue: ContextQueue) {
      super();
  }

  get isStreaming() {
    return !!this.stream && this.connectionProvider.has();
  }

  get paused() {
    return this.isStreaming && this.getConnection().dispatcher.paused;
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.isStreaming) {
      this.getConnection().dispatcher.setVolume(this.volume);
    }
  }

  async play(): Promise<void> {
    if (this.isStreaming) {
      return;
    }

    const connection = this.getConnection();

    this.stream = new QueueStream(
      () => this.getNextStream(),
      () => this.popNext(),
      connection.channel.bitrate);

    connection.play(this.stream, { seek: 0, volume: this.volume });

    connection.on('disconnect', () => {
      this.emitDone();
    });

    connection.dispatcher.once('close', () => {
      if (this.stream && !this.stream.destroyed) {
        this.stream.destroy();
      }
      this.stream = undefined;
    });

    connection.dispatcher.once('finish', async () => {
      if (this.stream && !this.stream.destroyed) {
        this.stream.destroy();
      }
      this.stream = undefined;

      // Start stream again if there are still items in the queue
      if (await this.queue.peek()) {
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
    if (this.isStreaming) {
      this.stream!.setBitrate(connection.channel.bitrate);
    }
    return connection;
  }

  private async getNextStream(): Promise<StreamData | undefined> {
    const nextTrack = await this.queue.peek();
    if (nextTrack) {
      return getTrackStream(nextTrack);
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