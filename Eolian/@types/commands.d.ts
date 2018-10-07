type CommandDetails = {
  name: string;
  permission: PERMISSION;
  details: string;
  keywords: Keyword[];
  usage: string[];
};

interface CommandParsingStrategy {

  /**
   * Verifies that the message received is directed to the bot
   * @param message 
   */
  messageInvokesBot(message: string): boolean;

  /**
   * Convert raw text into an actionable command object
   * @param message 
   */
  convertToExecutable(message: string, permission: PERMISSION): [CommandAction<unknown>, EolianBotError];

}