type CommandInfo = {
  name: string;
  details: string;
  permission: import('common/constants').PERMISSION;
  category: CommandCategory;
  keywords: Keyword[];
  usage: string[];
};

interface CommandAction {
  execute(context: CommandActionContext, params: CommandActionParams): Promise<any>;
}

interface Command {
  info: CommandInfo,
  createAction: (services: CommandActionServices) => CommandAction;
}

type CommandCategory = {
  name: string;
  details: string;
};

type CommandActionServices = {
  bot: BotService;
  users: import('services/user').EolianUserService;
  queues: import('services/queue').MusicQueueService;
  playerManager: PlayerManager;
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
  parseCommand(message: string, permission: import('common/constants').PERMISSION): [Command, import('common/errors').EolianBotError];

}