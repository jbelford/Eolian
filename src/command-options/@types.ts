import { TrackSource } from '@eolian/api/@types';
import { RangeArgument } from '@eolian/common/@types';
import { UserPermission } from '@eolian/common/constants';

export type CommandOptions = Partial<Record<KeywordName, boolean> & PatternValues>;

export interface CommandOptionsParsingStrategy {
  resolve(
    text: string,
    permission: UserPermission,
    keywords?: Set<string>,
    patterns?: Pattern[],
  ): CommandOptions;
}

export interface UrlArgument {
  value: string;
  source: TrackSource;
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
  Search = 'search',
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
  readonly permission: UserPermission;
  readonly shortName?: string;
  readonly group?: KeywordGroup;
  text(type: SyntaxType, short?: boolean): string;
}

export interface Pattern<T extends PatternName = PatternName> {
  readonly name: T;
  readonly details: string;
  readonly permission: UserPermission;
  // Higher priority means that this keyword should be parsed and removed from the text before others.
  readonly priority: number;
  readonly usage: (string | string[])[];
  readonly group?: KeywordGroup;

  ex(...text: string[]): ArgumentExample;

  /**
   * Check that the given text contains the keyword.
   * Removes the pattern information from the text and returns a new string.
   *
   * @param text
   */
  matchText(text: string, type: SyntaxType): PatternMatchResult<PatternValues[T]>;
}

export type KeywordName = Uppercase<
  | 'enable'
  | 'disable'
  | 'clear'
  | 'more'
  | 'less'
  | 'my'
  | 'soundcloud'
  | 'spotify'
  | 'youtube'
  | 'poem'
  | 'ai'
  | 'random'
  | 'playlist'
  | 'album'
  | 'artist'
  | 'next'
  | 'shuffle'
  | 'likes'
  | 'tracks'
  | 'fast'
  | 'short'
  | 'long'
>;

export type PatternName = keyof PatternValues;

export type PatternValues = {
  TOP: RangeArgument;
  BOTTOM: RangeArgument;
  SEARCH: string;
  IDENTIFIER: string;
  URL: UrlArgument;
  NUMBER: number[];
  ARG: string[];
};

export const enum SyntaxType {
  KEYWORD = 0,
  TRADITIONAL = 1,
  SLASH = 2,
}
