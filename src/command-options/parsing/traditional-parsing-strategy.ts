import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { CommandOptionsParsingStrategy, CommandOptions, SyntaxType } from '../@types';
import { KEYWORDS_MAPPED } from '../keywords';
import { patternMatch, checkSetKeyword } from './command-options-parsing-utils';
import { PATTERNS, PATTERNS_SORTED } from '../patterns';

export const TraditionalParsingStrategy: CommandOptionsParsingStrategy = {
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
      if (patternSet.has(pattern.name) && pattern.name !== PATTERNS.SEARCH.name) {
        text = patternMatch(text, permission, pattern, options, SyntaxType.TRADITIONAL);
      }
    }

    const reg = /(^|\s)-(?<keyword>\w+)/g;
    for (const match of text.matchAll(reg)) {
      if (match.groups) {
        const name = match.groups.keyword.toUpperCase();
        const keyword = KEYWORDS_MAPPED[name];
        if (keyword) {
          checkSetKeyword(keyword, permission, options, keywordSet.has(keyword.name));
        } else {
          throw new EolianUserError(`Unrecognized keyword \`${name}\`. Try again.`);
        }
      }
    }
    text = text.replace(reg, '').trim();

    if (patternSet.has(PATTERNS.SEARCH.name) && text.length) {
      options.SEARCH = text;
    }

    return options;
  },
};
