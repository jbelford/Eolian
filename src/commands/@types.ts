import { RangeArgument } from 'common/@types';
import { PERMISSION, SOURCE } from 'common/constants';
import { ContextClient, ContextCommandInteraction, ServerState } from 'framework/@types';

export interface BaseCommand {
  name: string;
  permission: PERMISSION;
  patterns?: Pattern[];
  dmAllowed?: boolean;
  noDefaultReply?: boolean;
  execute(context: CommandContext, options: CommandOptions): Promise<void>;
}

export type CommandArgOption = {
  name: string;
  details: string;
  getChoices?: () => string[];
};

export type CommandArgGroup = {
  required: boolean;
  options: CommandArgOption[];
}

export type CommandArgs = {
  base: boolean,
  groups: CommandArgGroup[]
};

export interface Command extends BaseCommand {
  shortDetails?: string;
  details: string;
  category: CommandCategory;
  keywords?: Keyword[];
  new?: boolean;
  usage: CommandUsage[];
  /**
   * Command doesn't use keywords/patterns
   */
  args?: CommandArgs;
}

export type MessageCommand = BaseCommand;

export interface CommandUsage {
  title?: string;
  example: ArgumentExample[] | string;
}

export interface CommandCategory {
  name: string;
  details: string;
  permission: PERMISSION;
}

export interface CommandParsingStrategy {
  messageInvokesBot(message: string, prefix?: string): boolean;
  parseCommand(message: string, permission: PERMISSION, type?: SyntaxType): ParsedCommand;
}

export type CommandOptionsParsingStrategy = (text: string, permission: PERMISSION, keywords?: string[], patterns?: string[]) => CommandOptions;

export interface ParsedCommand {
  command: BaseCommand;
  options: CommandOptions;
}

export interface CommandContext {
  client: ContextClient;
  interaction: ContextCommandInteraction;
  server?: ServerState;
}

export type CommandOptions = Partial<Record<KeywordName, boolean> & PatternValues>;

export interface UrlArgument {
  value: string;
  source: SOURCE;
}

export interface PatternMatchResult<T> {
  matches: boolean;
  newText: string;
  args?: T;
}

export const enum KeywordGroup {
  Source = 'source',
  Type = 'type',
  Switch = 'switch',
  Increment = 'increment',
  Search = 'search'
}

export interface KeywordGroupProperties {
  details: string;
}

export interface ArgumentExample {
  text(type: SyntaxType): string;
}

export interface Keyword extends ArgumentExample {
  readonly name: KeywordName;
  readonly details: string;
  readonly permission: PERMISSION;
  readonly group?: KeywordGroup;
}

export interface Pattern<T extends keyof PatternValues = keyof PatternValues> {
  readonly name: T;
  readonly details: string;
  readonly permission: PERMISSION;
  // Higher priority means that this keyword should be parsed and removed from the text before others.
  readonly priority: number;
  readonly usage: string[];
  readonly group?: KeywordGroup;

  ex(text: string): ArgumentExample;

  /**
   * Check that the given text contains the keyword.
   * Removes the pattern information from the text and returns a new string.
   *
   * @param text
   */
  matchText(text: string, type: SyntaxType): PatternMatchResult<PatternValues[T]>;
}

export type KeywordName = Uppercase<
  'enable'
  | 'disable'
  | 'clear'
  | 'more'
  | 'less'
  | 'my'
  | 'soundcloud'
  | 'spotify'
  | 'youtube'
  | 'playlist'
  | 'album'
  | 'artist'
  | 'next'
  | 'shuffle'
  | 'likes'
  | 'tracks'
  | 'fast'>;

export type PatternValues = {
  TOP: RangeArgument;
  BOTTOM: RangeArgument;
  SEARCH: string;
  IDENTIFIER: string;
  URL: UrlArgument;
  NUMBER: number[];
  ARG: string[];
}

export const enum SyntaxType {
  KEYWORD = 0,
  TRADITIONAL = 1,
  SLASH = 2
}