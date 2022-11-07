import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import {
  Keyword,
  CommandOptions,
  PatternValues,
  Pattern,
  SyntaxType,
  KeywordGroup,
} from '../@types';
import { PATTERNS_SORTED, PATTERNS } from '../patterns';

export function checkSetKeyword(
  keyword: Keyword,
  permission: UserPermission,
  options: CommandOptions,
  hasKeyword = true
) {
  if (hasKeyword) {
    if (keyword.permission > permission) {
      throw new EolianUserError(`You do not have permission to use ${keyword.name}!`);
    }
    options[keyword.name] = true;
  } else {
    throw new EolianUserError(
      `This command does not accept the \`${keyword.name}\` keyword. Try again without it.`
    );
  }
}

export function patternMatch<T extends keyof PatternValues>(
  text: string,
  permission: UserPermission,
  pattern: Pattern<T>,
  options: CommandOptions,
  syntax: SyntaxType,
  required = false
): string {
  const result = pattern.matchText(text, syntax);
  if (result.matches) {
    if (pattern.permission > permission) {
      throw new EolianUserError(`You do not have permission to use ${pattern.name}!`);
    }
    options[pattern.name] = result.args;
    text = result.newText;
  } else if (required) {
    throw new EolianUserError(
      `Provided option \`${pattern.name}\` is incorrectly specified. See \`/help ${pattern.name}\``
    );
  }
  return text;
}

export function matchPatterns(
  text: string,
  permission: UserPermission,
  patternSet: Set<string>,
  options: CommandOptions,
  group?: KeywordGroup
) {
  for (const pattern of PATTERNS_SORTED) {
    if (!group || pattern.group === group) {
      if (patternSet.has(pattern.name) && pattern.name !== PATTERNS.SEARCH.name) {
        text = patternMatch(text, permission, pattern, options, SyntaxType.SLASH);
      }
    }
  }
  if (
    patternSet.has(PATTERNS.SEARCH.name)
    && text.length
    && PATTERNS.SEARCH.permission <= permission
  ) {
    if (!group || PATTERNS.SEARCH.group === group) {
      options.SEARCH = text;
    }
  }
}
