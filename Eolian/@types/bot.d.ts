interface EolianBot {
  /**
   * Begin communication with the web service
   */
  start(): Promise<void>;

  /**
   * Close the connection with the web service
   */
  stop(): Promise<void>;

  /**
   * Registers strategy for handling messages received in chat
   */
  onMessage(commandParser: CommandParsingStrategy);
}

interface ContextUser {

  readonly id: string;
  readonly name: string;
  readonly avatar: string;
  readonly permission: import('../src/common/constants').PERMISSION;

}

interface ContextMessage {

  reply(message: string): Promise<void>;

  getButtons(): { emoji: string, count: number }[];

  delete(): Promise<void>;

}

interface ContextTextChannel {

  send(message: string): Promise<void>;

  sendEmbed(embed: EmbedMessage): Promise<void>;

}

interface BotService {

  readonly name: string;
  readonly pic: string;

  generateInvite(): Promise<string>;

}