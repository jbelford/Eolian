type Command = {
  name: string;
  details: string;
  permission: import('../src/common/constants').PERMISSION;
  category: CommandCategory;
  keywords: Keyword[];
  usage: string[];
  createAction: (params: CommandParams) => import('../src/commands/command').CommandAction;
};

type CommandCategory = {
  name: string;
  details: string;
};

type CommandActionParams = {
  user: ChatUser;
  message: MessageStrategy;
};

type CommandParams = {
  ENABLE?: boolean;
  DISABLE?: boolean;
  MORE?: boolean;
  LESS?: boolean;
  SOUNDCLOUD?: boolean;
  SPOTIFY?: boolean;
  YOUTUBE?: boolean;
  PLAYLIST?: boolean;
  ALBUM?: boolean;
  ARTIST?: boolean;
  NEXT?: boolean;
  SHUFFLE?: boolean;
  FAVORITES?: boolean;
  TRACKS?: boolean;
  TOP?: { start: number; stop: number };
  BOTTOM?: { start: number; stop: number };
  QUERY?: string;
  IDENTIFIER?: string;
  URL?: string;
  ARG?: string[];
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
  convertToExecutable(message: string, permission: import('../src/common/constants').PERMISSION): [import('../src/commands/command').CommandAction, EolianBotError];

}