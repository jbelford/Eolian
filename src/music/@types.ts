import { SOURCE } from 'common/constants';
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
  size: number,
  details: Track
}

export interface Player extends EventEmitter {

  isStreaming: boolean;

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