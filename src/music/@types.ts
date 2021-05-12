import { SOURCE } from 'common/constants';
import { ServerQueue } from 'data/@types';
import EventEmitter from 'events';
import { Readable } from 'stream';

export interface Track {
  id: string;
  title: string;
  poster: string;
  url: string;
  stream: string;
  artwork?: string;
  src: SOURCE;
}

export interface StreamData {
  readable: Readable,
  details: Track,
  opus?: boolean
}

export interface Player extends EventEmitter {

  readonly isStreaming: boolean;
  readonly paused: boolean;
  readonly queue: ServerQueue;

  setVolume(value: number): void;

  /**
   * Tells the player to start streaming.
   */
  play(): Promise<void>;

  /**
   * Tells the player to skip the song it is streaming.
   */
  skip(): Promise<void>;

  /**
   * Stops the player from streaming.
   *
   * Note: This does not close the player resource.
   */
  stop(): Promise<void>;

  /**
   * Tells the player to pause the stream.
   */
  pause(): Promise<void>;

  /**
   * Tells the player to resume the stream.
   */
  resume(): Promise<void>;

}