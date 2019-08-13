import { PERMISSION, SOURCE } from 'common/constants';
import { ContextClient, ContextMessage, ContextQueue, ContextTextChannel, ContextUser } from 'eolian/@types';

export interface Command {
  name: string;
  details: string;
  permission: PERMISSION;
  category: CommandCategory;
  keywords: Array<Keyword<unknown>>;
  usage: string[];
  createAction(): CommandAction;
}

export interface CommandCategory {
  name: string;
  details: string;
}

export interface CommandAction {
  execute(context: CommandContext, options: CommandOptions): Promise<void>;
}

export interface CommandParsingStrategy {
  messageInvokesBot(message: string): boolean;
  parseCommand(message: string, permission: PERMISSION): ParsedCommand;
}

export interface ParsedCommand {
  command: Command;
  options: CommandOptions;
}

export interface CommandContext {
  client: ContextClient;
  user: ContextUser;
  message: ContextMessage;
  channel: ContextTextChannel;
  queue: ContextQueue;
}

export interface CommandOptions {
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
  TOP?: RangeArgument;
  BOTTOM?: RangeArgument;
  QUERY?: string;
  IDENTIFIER?: string;
  URL?: UrlArgument;
  ARG?: string[];
}

export interface RangeArgument {
  start: number;
  stop?: number;
}

export interface UrlArgument {
  value: string;
  source: SOURCE;
}

export interface KeywordMatchResult<T> {
  matches: boolean;
  newText: string;
  args?: T;
}

export interface Keyword<T> {
  readonly name: string;
  readonly details: string;
  readonly permission: PERMISSION;
  readonly usage: string[];
  // Higher priority means that this keyword should be parsed and removed from the text before others.
  readonly priority: number;

  /**
   * Check that the given text contains the keyword.
   * Removes the keyword information from the text and returns a new string.
   *
   * @param text
   */
  matchText(text: string): KeywordMatchResult<T>;
}

export interface Keywords {
  [key: string]: Keyword<unknown> | undefined;
  ENABLE: Keyword<boolean>;
  DISABLE: Keyword<boolean>;
  CLEAR: Keyword<boolean>;
  MORE: Keyword<boolean>;
  LESS: Keyword<boolean>;
  MY: Keyword<boolean>;
  SOUNDCLOUD: Keyword<boolean>;
  SPOTIFY: Keyword<boolean>;
  YOUTUBE: Keyword<boolean>;
  PLAYLIST: Keyword<boolean>;
  ALBUM: Keyword<boolean>;
  ARTIST: Keyword<boolean>;
  NEXT: Keyword<boolean>;
  SHUFFLE: Keyword<boolean>;
  FAVORITES: Keyword<boolean>;
  TRACKS: Keyword<boolean>;
  TOP: Keyword<RangeArgument>;
  BOTTOM: Keyword<RangeArgument>;
  QUERY: Keyword<string>;
  IDENTIFIER: Keyword<string>;
  URL: Keyword<UrlArgument>;
  ARG: Keyword<string[]>;
}
