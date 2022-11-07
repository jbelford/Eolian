import { UserPermission } from '@eolian/common/constants';
import { CommandOptionsParsingStrategy, CommandOptions, SyntaxType } from '../@types';
import { patternMatch, checkSetKeyword } from './command-options-parsing-utils';
import { KEYWORDS } from '../keywords';
import { PATTERNS_SORTED } from '../patterns';

export const KeywordParsingStrategy: CommandOptionsParsingStrategy = {
  resolve(
    text: string,
    permission: UserPermission,
    keywords: string[] = [],
    patterns: string[] = []
  ): CommandOptions {
    const keywordSet = new Set<string>(keywords);
    const patternSet = new Set<string>(patterns);

    const options: CommandOptions = {};
    for (const pattern of PATTERNS_SORTED) {
      if (patternSet.has(pattern.name)) {
        text = patternMatch(text, permission, pattern, options, SyntaxType.KEYWORD);
      }
    }

    const split = new Set<string>(text.toLowerCase().split(/\s+/));

    for (const keyword of Object.values(KEYWORDS)) {
      if (split.has(keyword!.name.toLowerCase())) {
        checkSetKeyword(keyword!, permission, options, keywordSet.has(keyword!.name));
      }
    }

    return options;
  },
};
