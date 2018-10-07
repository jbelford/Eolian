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
   * Registers strategie for handling messages received in chat
   */
  onMessage(commandParser: CommandParsingStrategy);
}

type EmbedMessage = {

};


interface MessageStrategy {

  send(message: string): Promise<void>;

  sendEmbed(embed: EmbedMessage);

}