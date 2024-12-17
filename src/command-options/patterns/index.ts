import { AbsRangeArgument } from '@eolian/common/@types';
import { convertRangeToAbsolute } from '@eolian/common/util';
import { CommandOptions, Pattern, PatternName } from '../@types';
import { ARG_PATTERN } from './arg-pattern';
import { BOTTOM_PATTERN } from './bottom-pattern';
import { IDENTIFIER_PATTERN } from './identifier-pattern';
import { NUMBER_PATTERN } from './number-pattern';
import { SEARCH_PATTERN } from './search-pattern';
import { TOP_PATTERN } from './top-pattern';
import { URL_PATTERN } from './url-pattern';

type Patterns = Partial<Record<string, Pattern>> & {
  [name in PatternName]: Pattern<name>;
};

export const PATTERNS: Readonly<Patterns> = {
  NUMBER: NUMBER_PATTERN,
  TOP: TOP_PATTERN,
  BOTTOM: BOTTOM_PATTERN,
  ARG: ARG_PATTERN,
  URL: URL_PATTERN,
  IDENTIFIER: IDENTIFIER_PATTERN,
  SEARCH: SEARCH_PATTERN,
};

export const PATTERNS_SORTED = (Object.values(PATTERNS) as Pattern[]).sort(
  (a, b) => b.priority - a.priority,
);

export function getRangeOption(
  options: CommandOptions,
  total: number,
): AbsRangeArgument | undefined {
  let range: AbsRangeArgument | undefined;
  if (options.TOP) {
    range = convertRangeToAbsolute(options.TOP, total);
  } else if (options.BOTTOM) {
    range = convertRangeToAbsolute(options.BOTTOM, total, true);
  }
  return range;
}
