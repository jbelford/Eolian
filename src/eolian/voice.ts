import { getTrackStream } from 'api';
import { QueueStream } from 'common/qstream';
import { PlayerStore } from 'data/@types';
import { VoiceChannel, VoiceConnection } from 'discord.js';
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

  constructor(private readonly connection: VoiceConnection,
    private readonly queue: ContextQueue,
    private readonly store: PlayerStore) {
  }

  get channelId(): string {
    return this.connection.channel.id;
  }

  get player(): Player {
    let player: DiscordPlayer = <DiscordPlayer>this.store.get(this.connection.channel.guild.id);
    if (!player) {
      player = new DiscordPlayer(this.connection, this.queue);
      this.store.store(this.connection.channel.guild.id, player);
    } else {
      player.setConnection(this.connection);
    }
    return player;
  }

  async disconnect(): Promise<void> {
    this.connection.disconnect();
  }

}

export class DiscordPlayer implements Player {

  private volume: number = 0.5;
  private stream?: QueueStream;

  constructor(
    private connection: VoiceConnection,
    private readonly queue: ContextQueue) {
  }

  setConnection(connection: VoiceConnection) {
    this.connection = connection;
    if (this.stream) {
      this.stream.setBitrate(this.connection.channel.bitrate);
    }
  }

  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.stream) {
      this.connection.dispatcher.setVolume(this.volume);
    }
  }

  async play(): Promise<void> {
    if (!this.stream) {
      this.stream = new QueueStream(
        () => this.getNextStream(),
        () => this.popNext(),
        this.connection.channel.bitrate);

      this.connection.play(this.stream, { seek: 0, volume: this.volume });
      this.connection.dispatcher.once('close', () => {
        if (this.stream && !this.stream.destroyed) {
          this.stream.destroy();
        }
        this.stream = undefined;
      });
      this.connection.dispatcher.once('finish', () => {
        if (this.stream && !this.stream.destroyed) {
          this.stream.destroy();
        }
        this.connection.disconnect();
      });
    }
  }

  async skip(): Promise<void> {
    if (this.stream) {
      this.stream.skip();
    }
  }

  async stop(): Promise<void> {
  }

  async pause(): Promise<void> {
    if (this.stream) {
      this.connection.dispatcher.pause();
    }
  }

  async resume(): Promise<void> {
    if (this.stream) {
      this.connection.dispatcher.resume();
    }
  }

  private async getNextStream(): Promise<StreamData | undefined> {
    const nextTrack = await this.queue.peek();
    if (nextTrack) {
      return getTrackStream(nextTrack);
    }
    return undefined;
  }

  private async popNext(): Promise<void> {
    await this.queue.pop();
  }
}