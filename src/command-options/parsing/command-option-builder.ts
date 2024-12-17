import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { CommandOptions, Keyword, Pattern, PatternName, SyntaxType } from '../@types';
import { PATTERNS } from '../patterns';
import { ICommandOptionBuilder } from './@types';

export class CommandOptionBuilder implements ICommandOptionBuilder {
  private options: CommandOptions = {};

  constructor(
    private readonly permission: UserPermission,
    private readonly syntax = SyntaxType.KEYWORD,
  ) {}

  withPattern<T extends PatternName>(pattern: Pattern<T>, text: string, required = false): string {
    const result = pattern.matchText(text, this.syntax);
    if (result.matches) {
      if (pattern.permission > this.permission) {
        throw new EolianUserError(`You do not have permission to use ${pattern.name}!`);
      }
      this.options[pattern.name] = result.args;
      return result.newText;
    } else if (required) {
      throw new EolianUserError(
        `Provided option \`${pattern.name}\` is incorrectly specified. See \`/help ${pattern.name}\``,
      );
    }
    return text;
  }

  withPatterns(patterns: Pattern[], text: string): string {
    let hasSearch = false;
    patterns.forEach(pattern => {
      if (pattern.name !== PATTERNS.SEARCH.name) {
        text = this.withPattern(pattern, text);
      } else if (PATTERNS.SEARCH.permission <= this.permission) {
        hasSearch = true;
      }
    });
    text = text.trim();
    if (hasSearch && text.length) {
      this.options.SEARCH = text;
      return '';
    }
    return text;
  }

  withKeyword(keyword: Keyword, hasKeyword = true) {
    if (hasKeyword) {
      if (keyword.permission > this.permission) {
        throw new EolianUserError(`You do not have permission to use ${keyword.name}!`);
      }
      this.options[keyword.name] = true;
    } else {
      throw new EolianUserError(
        `This command does not accept the \`${keyword.name}\` keyword. Try again without it.`,
      );
    }
  }

  withTextArgs(text: string) {
    if (text.trim().length > 0) {
      this.options.ARG = text.trim().split(' ');
    }
  }

  withArgs(args: string[]) {
    this.options.ARG = args;
  }

  get(): CommandOptions {
    return this.options;
  }
}
