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

interface MessageService {

  reply(message: string): Promise<void>;

  send(message: string): Promise<void>;

  sendEmbed(embed: EmbedMessage): Promise<void>;

}

interface BotService {

  name: string;

  pic: string;

  generateInvite(): Promise<string>;

}