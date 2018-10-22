type Command = {
  name: string;
  details: string;
  permission: import('common/constants').PERMISSION;
  category: CommandCategory;
  keywords: Keyword[];
  usage: string[];
  action: CommandActionConstructor;
};

interface CommandActionConstructor {
  new(services: CommandActionServices): import('commands/command').CommandAction;
}

type CommandCategory = {
  name: string;
  details: string;
};

type CommandActionServices = {
  bot: BotService;
  users: import('db/user-service').EolianUserService;
};

type CommandActionContext = {
  user: ContextUser;
  message: ContextMessage;
  channel: ContextTextChannel;
};

type CommandActionParams = {
  ENABLE?: boolean;
  DISABLE?: boolean;
  CLEAR?: boolean;
  MORE?: boolean;
  LESS?: boolean;
  MY?: boolean;
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
  URL?: { value: string; source: import('common/constants').SOURCE };
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
  parseParams(message: string, permission: import('common/constants').PERMISSION): [CommandActionParams, string];

  /**
   * Parse command from text
   */
  parseCommand(message: string, permission: import('common/constants').PERMISSION, commands: import('commands/command').CommandAction[]):
    [import('commands/command').CommandAction, import('common/errors').EolianBotError];

}