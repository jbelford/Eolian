type Track = {
  id: string;
  title: string;
  poster: string;
  url: string;
  stream: string;
  artwork?: string;
  src: SOURCE;
};

type StreamData = {
  stream: import('stream').Stream,
  size: number,
};

interface PlayerManager {

  /**
   * Fetches a player in the registry
   */
  getPlayer(guildId: string): Player;

  /**
   * Creates a new player and returns it
   */
  createPlayer(guildId: string): Promise<Player>;

}

interface Player {

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

  /**
   * Returns a subscription to an event which is emitted anytime
   * the current song playing changes to a new song.
   */
  subscribe(observer: import('rxjs').PartialObserver<Track>): import('rxjs').Subscription;


}