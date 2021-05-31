import { RangeArgument } from 'common/@types';
import { PERMISSION, SOURCE } from 'common/constants';
import { ContextClient, ContextMessage, ContextTextChannel, ContextUser, ServerState } from 'eolian/@types';

export interface Command {
  name: string;
  details: string;
  permission: PERMISSION;
  category: CommandCategory;
  // If using keyword parsing
  keywords?: Array<Keyword<unknown>>;
  dmAllowed?: boolean;
  usage: CommandUsage[];
  execute(context: CommandContext, options: CommandOptions): Promise<void>;
}

export interface CommandUsage {
  title?: string;
  example: string;
}

export interface CommandCategory {
  name: string;
  details: string;
}

export interface CommandParsingStrategy {
  messageInvokesBot(message: string, prefix?: string): boolean;
  parseCommand(message: string, permission: PERMISSION): ParsedCommand;
}

export type CommandOptionsParsingStrategy = (text: string, permission: PERMISSION, keywords?: string[]) => CommandOptions;

export interface ParsedCommand {
  command: Command;
  options: CommandOptions;
}

export interface CommandContext {
  client: ContextClient;
  user: ContextUser;
  message: ContextMessage;
  channel: ContextTextChannel;
  server?: ServerState;
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
  LIKES?: boolean;
  TRACKS?: boolean;
  TOP?: RangeArgument;
  BOTTOM?: RangeArgument;
  SEARCH?: string;
  IDENTIFIER?: string;
  NUMBER?: number;
  URL?: UrlArgument;
  ARG?: string[];
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
  [key: string]: Keyword<unknown>;
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
  LIKES: Keyword<boolean>;
  TRACKS: Keyword<boolean>;
  TOP: Keyword<RangeArgument>;
  BOTTOM: Keyword<RangeArgument>;
  SEARCH: Keyword<string>;
  IDENTIFIER: Keyword<string>;
  URL: Keyword<UrlArgument>;
  NUMBER: Keyword<number>;
  ARG: Keyword<string[]>;
}
