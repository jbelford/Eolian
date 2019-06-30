type Command = {
  name: string;
  details: string;
  permission: PERMISSION;
  category: CommandCategory;
  keywords: Keyword[];
  usage: string[];
  action: CommandActionConstructor;
};

interface ICommandAction {
  readonly name: string;
  readonly details: string;
  readonly permission: PERMISSION;
  readonly category: CommandCategory;
  readonly keywords: Keyword[];
  readonly usage: string[];

  execute(context: CommandActionContext, params: CommandActionParams): Promise<any>;
}

interface CommandActionConstructor {
  new(services: CommandActionServices): ICommandAction;
}

type CommandCategory = {
  name: string;
  details: string;
};

type CommandActionServices = {
  bot: BotService;
  users: import('data/user').EolianUserService;
  queues: import('data/queue').MusicQueueService;
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
  URL?: { value: string; source: SOURCE };
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
  parseParams(message: string, permission: PERMISSION): [CommandActionParams, string];

  /**
   * Parse command from text
   */
  parseCommand(message: string, permission: PERMISSION, commands: ICommandAction[]):
    [ICommandAction, import('common/errors').EolianBotError];

}