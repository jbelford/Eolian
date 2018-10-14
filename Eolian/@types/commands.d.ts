type Command = {
  name: string;
  details: string;
  permission: import('../src/common/constants').PERMISSION;
  category: CommandCategory;
  keywords: Keyword[];
  usage: string[];
  action: CommandActionConstructor;
};

interface CommandActionConstructor {
  new(services: CommandActionServices): import('../src/commands/command').CommandAction;
}

type CommandCategory = {
  name: string;
  details: string;
};

type CommandActionServices = {
  bot: BotService;
};

type CommandActionContext = {
  user: ContextUser;
  message: ContextMessage;
  channel: ContextTextChannel;
};

type CommandActionParams = {
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
   * Parse params from text and return text with those params removed.
   */
  parseParams(message: string, permission: import('../src/common/constants').PERMISSION): [CommandActionParams, string];

  /**
   * Parse command from text
   */
  parseCommand(message: string, permission: import('../src/common/constants').PERMISSION, commands: import('../src/commands/command').CommandAction[]):
    [import('../src/commands/command').CommandAction, import('../src/common/errors').EolianBotError];

}