import {
  AudioResource,
  AudioPlayer,
  createAudioPlayer,
  NoSubscriberBehavior,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  createAudioResource,
  StreamType,
} from '@discordjs/voice';
import { Track } from '@eolian/api/@types';
import { DEFAULT_VOLUME, IDLE_TIMEOUT_MINS } from '@eolian/common/constants';
import { environment } from '@eolian/common/env';
import { logger } from '@eolian/common/logger';
import { ContextClient, ContextVoiceChannel, ContextMusicQueue } from '@eolian/framework/@types';
import { Readable } from 'stream';
import { Player } from './@types';
import { DiscordVoiceConnection } from './discord-voice-connection';
import { SongStream } from './song-stream';
import EventEmitter from 'node:events';

const PLAYER_TIMEOUT = 1000 * 60 * 3;
const PLAYER_RETRIES = 2;
const NEXT_SONG_ATTEMPTS = 5;

/**
 *
 * Stream pipeline:
 *
 *   --------------------------------- Replace on force skip -----------------------------
 * |                                                                                      |
 *  Song readable stream -> PCM transformer (ffmpeg) -> Volume Transform -> Opus Encoder -> Discord
 * |                                                 |
 *  ------- Replace these 2 when song ends ----------
 *
 */
export class DiscordPlayer extends EventEmitter implements Player {
  private lastUsed = Date.now();
  private timeoutCheck: NodeJS.Timeout | null = null;
  private songStream: SongStream | null = null;
  private audioResource: AudioResource | null = null;

  private _audioPlayer: AudioPlayer | null = null;
  private _isStreaming = false;
  private _nightcore = false;
  private _bass = false;
  private _paused = false;

  constructor(
    private readonly client: ContextClient,
    readonly queue: ContextMusicQueue,
    private _volume = DEFAULT_VOLUME,
  ) {
    super();
  }

  private get audioPlayer(): AudioPlayer {
    if (!this._audioPlayer) {
      this._audioPlayer = createAudioPlayer({
        debug: environment.debug,
        behaviors: {
          noSubscriber: NoSubscriberBehavior.Pause,
          maxMissedFrames: Number.MAX_VALUE,
        },
      });
      this._audioPlayer.on('error', this.streamErrorHandler);
      if (environment.debug) {
        this._audioPlayer.on('debug', message => {
          logger.debug(message);
        });
        this._audioPlayer.on(AudioPlayerStatus.Buffering, () => {
          logger.debug('Audio player is buffering');
        });
        this._audioPlayer.on(AudioPlayerStatus.Playing, () => {
          logger.debug('Audio player is playing');
        });
        this._audioPlayer.on(AudioPlayerStatus.Paused, () => {
          logger.debug('Audio player is paused');
        });
      }
      this._audioPlayer.on(AudioPlayerStatus.Idle, () => {
        logger.debug('Audio player is idle');
        this.stop();
      });
    }
    return this._audioPlayer;
  }

  private cleanup = (connection = this.client.getVoice() as DiscordVoiceConnection | undefined) => {
    if (this.timeoutCheck) {
      clearInterval(this.timeoutCheck);
      this.timeoutCheck = null;
    }
    if (connection) {
      connection.discordConnection.removeListener(
        VoiceConnectionStatus.Disconnected,
        this.onDisconnectHandler,
      );
      connection.close();
    }
    this.audioPlayer?.stop();
    this.songStream?.close();
    this.audioResource = null;
    this.songStream = null;
    if (this._isStreaming) {
      this.emitDone();
    }
    this._isStreaming = false;
    this._paused = false;
  };

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

  get bass(): boolean {
    return this._bass;
  }

  get idle(): boolean {
    return (
      (!this.isStreaming || this._paused) && Date.now() - this.lastUsed >= IDLE_TIMEOUT_MINS * 1000
    );
  }

  getChannel(): ContextVoiceChannel | undefined {
    const voice = this.client.getVoice();
    return voice && voice.getChannel();
  }

  async close(): Promise<void> {
    this.stop();
    this._audioPlayer = null;
  }

  setVolume(value: number): void {
    this.lastUsed = Date.now();
    this._volume = Math.max(0, Math.min(1, value));
    if (this.songStream) {
      this.songStream.volume = this._volume;
    }
    this.emitUpdate();
  }

  setNightcore(on: boolean): void {
    this._nightcore = on;
  }

  setBassBoost(on: boolean): void {
    this._bass = on;
  }

  async play(): Promise<void> {
    if (!this.isStreaming) {
      this._isStreaming = true;
      try {
        const connection = this.client.getVoice() as DiscordVoiceConnection | undefined;
        if (!connection) {
          throw new Error('No voice connection!');
        }
        connection.discordConnection.on(
          VoiceConnectionStatus.Disconnected,
          this.onDisconnectHandler,
        );
        this.timeoutCheck = setInterval(this.timeoutCheckHandler, PLAYER_TIMEOUT);

        await this.startNewStream();

        if (!connection.subscribe(this.audioPlayer)) {
          throw new Error('Failed to subscribe!');
        }
      } catch (e: any) {
        this.streamErrorHandler(e);
      }
    }
  }

  async skip(): Promise<void> {
    if (this.isStreaming) {
      const size = await this.queue.size(true);
      if (size > 0) {
        await this.songStream?.close();
        this.songStream = null;
        await this.startNewStream();
      } else {
        this.stop();
      }
    }
  }

  private onDisconnectHandler = async () => {
    const connection = this.client.getVoice() as DiscordVoiceConnection | undefined;
    if (connection) {
      const reconnected = await connection.awaitReconnect();
      if (!reconnected) {
        this.cleanup(connection);
      }
    }
  };

  stop(): void {
    this.cleanup();
  }

  async pause(): Promise<void> {
    if (this.isStreaming && !this.paused) {
      this.lastUsed = Date.now();
      if (this.audioPlayer!.pause(true)) {
        this._paused = true;
        this.emitUpdate();
      }
    }
  }

  async resume(): Promise<void> {
    if (this.isStreaming && this.paused) {
      this.lastUsed = Date.now();
      if (this.audioPlayer!.unpause()) {
        this._paused = false;
        this.emitUpdate();
      }
    }
  }

  private async startNewStream(): Promise<void> {
    try {
      const input = await this.getStream();
      if (!input) {
        throw new Error('Missing stream!');
      }

      this.audioResource = createAudioResource(input, {
        inputType: StreamType.Raw,
        inlineVolume: false,
        silencePaddingFrames: 30,
      });

      this.audioPlayer.play(this.audioResource);
    } catch (e: any) {
      this.streamErrorHandler(e);
    }
  }

  private async getStream(): Promise<Readable | null> {
    if (!this.songStream) {
      this.songStream = new SongStream(this.volume, PLAYER_RETRIES);
      this.songStream.on('end', this.streamEndHandler);
      this.songStream.once('error', this.streamErrorHandler);
      this.songStream.on('retry', this.onRetryHandler);
    }
    let track = await this.queue.peek();
    for (let i = 0; i < NEXT_SONG_ATTEMPTS && track; ++i) {
      const success = await this.songStream.setStreamTrack(track, {
        nightcore: this.nightcore,
        bass: this.bass,
      });
      if (success) {
        this._paused = false;
        await this.popNext();
        return this.songStream.stream;
      } else {
        this.emitTrackFailure(track);
        await this.queue.pop();
        track = await this.queue.peek();
      }
    }
    return null;
  }

  private timeoutCheckHandler = () => {
    if (!this.getChannel()?.hasPeopleListening()) {
      this.emitIdle();
      this.stop();
    }
  };

  private streamEndHandler = async () => {
    try {
      if (this.getChannel()?.hasPeopleListening()) {
        if (await this.getStream()) {
          return;
        }
      } else {
        this.emitIdle();
      }
      this.songStream!.end();
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

  private emitTrackFailure(track: Track) {
    this.emit('trackFailure', track);
  }

  private emitUpdate() {
    return this.emit('update');
  }

  private streamErrorHandler = (err: Error) => {
    logger.warn(`Cleanup stream due to error: %s`, err);
    this.stop();
    this.emitError();
  };
}
