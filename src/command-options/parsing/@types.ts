import { CommandOptions, Keyword, Pattern, PatternName } from '../@types';

export interface ICommandOptionBuilder {
  withPattern<T extends PatternName>(pattern: Pattern<T>, text: string, required?: boolean): string;
  withPatterns(patterns: Pattern[], text: string): string;
  withKeyword(keyword: Keyword, hasKeyword?: boolean): void;
  withTextArgs(text: string): void;
  withArgs(args: string[]): void;
  get(): CommandOptions;
}

export interface ITextCommandOptionBuilder {
  withPatterns(patterns: Pattern[]): void;
  withKeywords(keywords: Set<string>): void;
  withTextArgs(): void;
  get(): CommandOptions;
}
