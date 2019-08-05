type CommandInfo = {
  name: string;
  details: string;
  permission: import('common/constants').PERMISSION;
  category: CommandCategory;
  keywords: Keyword<unknown>[];
  usage: string[];
};

interface CommandAction {
  execute(context: CommandActionContext, params: CommandActionParams): Promise<void>;
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
  // playerManager: PlayerManager;
};

type CommandActionContext = {
  user: ContextUser;
  message: ContextMessage;
  channel: ContextTextChannel;
};

interface CommandActionParams {
  [key: string]: any;
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
  TOP?: IRangeParam;
  BOTTOM?: IRangeParam;
  QUERY?: string;
  IDENTIFIER?: string;
  URL?: IUrlParam;
  ARG?: string[];
}

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
  parseCommand(message: string, permission: import('common/constants').PERMISSION): [Command | null, import('common/errors').EolianBotError | null];

}