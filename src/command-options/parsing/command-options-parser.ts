import { UserPermission } from '@eolian/common/constants';
import { CommandOptions, CommandOptionsParsingStrategy, Pattern, SyntaxType } from '../@types';
import { TextCommandOptionBuilder } from './text-command-option-builder';

export class CommandOptionsParser implements CommandOptionsParsingStrategy {
  constructor(private readonly syntax: SyntaxType) {}

  resolve(
    text: string,
    permission: UserPermission,
    keywords?: Set<string>,
    patterns?: Pattern[],
  ): CommandOptions {
    const builder = new TextCommandOptionBuilder(text, permission, this.syntax);

    if (patterns || keywords) {
      if (patterns) {
        builder.withPatterns(patterns);
      }

      if (keywords) {
        builder.withKeywords(keywords);
      }
    } else {
      builder.withTextArgs();
    }

    return builder.get();
  }
}
