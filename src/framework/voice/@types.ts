import { Idleable, Closable, ProgressUpdater } from '@eolian/common/@types';
import { EventEmitter } from 'node-cache';
import { ContextMusicQueue, ContextVoiceChannel } from '../@types';
import { Track } from '@eolian/api/@types';

export interface Player extends EventEmitter, Idleable, Closable {
  readonly isStreaming: boolean;
  readonly currentTrack?: Track;
  readonly paused: boolean;
  readonly queue: ContextMusicQueue;
  readonly volume: number;
  readonly nightcore: boolean;
  readonly bass: boolean;
  getChannel(): ContextVoiceChannel | undefined;
  setVolume(value: number): void;
  setNightcore(on: boolean): void;
  setBassBoost(on: boolean): void;
  play(progress?: ProgressUpdater<string>): Promise<void>;
  skip(progress?: ProgressUpdater<string>): Promise<void>;
  stop(): void;
  pause(): Promise<void>;
  resume(): Promise<void>;
}
