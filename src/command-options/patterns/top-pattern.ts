import { RangeArgument } from '@eolian/common/@types';
import { UserPermission } from '@eolian/common/constants';
import { SyntaxType, Pattern } from '../@types';
import { matchText, RangeExample } from './patterns-utils';

function getTopPatternReg(type: SyntaxType) {
  let reg: RegExp;
  switch (type) {
    case SyntaxType.KEYWORD:
      reg = /(^|\s)TOP\s+((\d+)(:(-?\d+))?)/i;
      break;
    case SyntaxType.TRADITIONAL:
      reg = /(^|\s)-TOP\s+((\d+)(:(-?\d+))?)/i;
      break;
    case SyntaxType.SLASH:
      reg = /(^|\s)((\d+)(:(-?\d+))?)/i;
      break;
  }
  return reg;
}

export const TOP_PATTERN: Pattern<'TOP'> = {
  name: 'TOP',
  details: 'Indicates to fetch the range of tracks starting from the beginning in the list.',
  permission: UserPermission.User,
  usage: [
    '100  # Get the first 100 songs',
    '4:10  # Get the 4th song to the 10th song',
    '5:-5  # Get the 5th song to the 5th last song',
  ],
  priority: 2,
  ex: text => new RangeExample(text, 'top'),
  matchText: (text, type) => {
    const reg: RegExp = getTopPatternReg(type);
    const match = matchText(text, reg);
    let args: RangeArgument | undefined;
    if (match.matches && match.args && match.args.length >= 5) {
      args = { start: +match.args[2] };
      if (match.args[3]) args.stop = +match.args[4];
    }
    return { matches: match.matches, newText: match.newText, args };
  },
};
