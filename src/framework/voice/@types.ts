import { Idleable, Closable } from '@eolian/common/@types';
import { EventEmitter } from 'node-cache';
import { ContextMusicQueue, ContextVoiceChannel } from '../@types';

export interface Player extends EventEmitter, Idleable, Closable {
  readonly isStreaming: boolean;
  readonly paused: boolean;
  readonly queue: ContextMusicQueue;
  readonly volume: number;
  readonly nightcore: boolean;
  readonly bass: boolean;
  getChannel(): ContextVoiceChannel | undefined;
  setVolume(value: number): void;
  setNightcore(on: boolean): void;
  setBassBoost(on: boolean): void;
  play(): Promise<void>;
  skip(): Promise<void>;
  stop(): void;
  pause(): Promise<void>;
  resume(): Promise<void>;
}
