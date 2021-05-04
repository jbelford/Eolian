import { SOURCE } from 'common/constants';
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
  details: unknown
}

export interface PlayerManager {

  /**
   * Fetches a player in the registry
   */
  getPlayer(guildId: string): Player;

  /**
   * Creates a new player and returns it
   */
  createPlayer(guildId: string): Promise<Player>;

}

export interface Player {

  readonly guildId: string;

  /**
   * The ID of the message which is associated with this player.
   */
  messageId: string;

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

  /**
   * Close any resources or connections used by the player
   */
  close(): Promise<void>

}