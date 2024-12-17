import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { CommandOptions, Pattern, PatternName, SyntaxType } from '../@types';
import { KEYWORDS_MAPPED } from '../keywords';
import { PATTERNS } from '../patterns';
import { ITextCommandOptionBuilder } from './@types';
import { CommandOptionBuilder } from './command-option-builder';

export class TextCommandOptionBuilder implements ITextCommandOptionBuilder {
  private baseBuilder: CommandOptionBuilder;
  private hasSearch = false;

  constructor(
    private text: string,
    private readonly permission: UserPermission,
    private readonly syntax = SyntaxType.KEYWORD,
  ) {
    this.baseBuilder = new CommandOptionBuilder(permission, syntax);
  }

  withPatterns(patterns: Pattern[]) {
    if (this.syntax === SyntaxType.KEYWORD) {
      patterns.forEach(pattern => this.withPattern(pattern));
    } else {
      patterns.forEach(pattern => {
        if (pattern.name !== PATTERNS.SEARCH.name) {
          this.withPattern(pattern);
        } else if (PATTERNS.SEARCH.permission <= this.permission) {
          this.hasSearch = true;
        }
      });
    }
  }

  withKeywords(keywords: Set<string>) {
    if (this.syntax === SyntaxType.KEYWORD) {
      this.parseKeywordSyntax(keywords);
    } else {
      this.parseFlagSyntax(keywords);
    }
  }

  withTextArgs() {
    this.baseBuilder.withTextArgs(this.text);
  }

  get(): CommandOptions {
    const options = this.baseBuilder.get();

    if (this.syntax === SyntaxType.TRADITIONAL && this.hasSearch) {
      const text = this.text.trim();
      if (text.length) {
        options.SEARCH = this.text;
      }
    }

    return options;
  }

  private parseKeywordSyntax(keywords: Set<string>) {
    const words = new Set<string>(this.text.toUpperCase().split(/\s+/));
    for (const word of words) {
      const keyword = KEYWORDS_MAPPED[word];
      if (keyword) {
        this.baseBuilder.withKeyword(keyword, keywords.has(keyword.name));
      }
    }
  }

  private parseFlagSyntax(keywords: Set<string>) {
    const reg = /(^|\s)-(?<keyword>\w+)/g;
    for (const match of this.text.matchAll(reg)) {
      if (match.groups) {
        const name = match.groups.keyword.toUpperCase();
        const keyword = KEYWORDS_MAPPED[name];
        if (keyword) {
          this.baseBuilder.withKeyword(keyword, keywords.has(keyword.name));
        } else {
          throw new EolianUserError(`Unrecognized keyword \`${name}\`. Try again.`);
        }
      }
    }
    this.text = this.text.replace(reg, '').trim();
  }

  private withPattern<T extends PatternName>(pattern: Pattern<T>) {
    this.text = this.baseBuilder.withPattern(pattern, this.text);
  }
}
