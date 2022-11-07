import { UserPermission } from '@eolian/common/constants';
import { PatternMatchResult, Pattern } from '../@types';
import { PassthroughExample } from './patterns-utils';

export function matchAll(text: string, reg: RegExp, group: number): PatternMatchResult<string[]> {
  const matches = text.matchAll(reg);
  const result: PatternMatchResult<string[]> = { matches: false, newText: text, args: [] };
  for (const match of matches) {
    result.matches = true;
    result.newText = result.newText.replace(match[0], '');
    result.args!.push(match[group + 1]);
  }
  return result;
}

export const NUMBER_PATTERN: Pattern<'NUMBER'> = {
  name: 'NUMBER',
  details: 'Indicates to specify a number.',
  permission: UserPermission.User,
  usage: ['50', '0.5', '-100', '10 11'],
  priority: 1,
  ex: text => new PassthroughExample(NUMBER_PATTERN.name, text),
  matchText: (text: string) => {
    const match = matchAll(text, /(?<=\s|^)(-?\d+(\.\d+)?)(?=\s|$)/g, 0);
    return {
      matches: match.matches,
      newText: match.newText,
      args: match.args ? match.args.map(a => +a) : undefined,
    };
  },
};
