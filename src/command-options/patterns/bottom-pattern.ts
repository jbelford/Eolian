import { RangeArgument } from '@eolian/common/@types';
import { UserPermission } from '@eolian/common/constants';
import { SyntaxType, Pattern } from '../@types';
import { RangeExample, matchText } from './patterns-utils';

function getBottomPatternReg(type: SyntaxType) {
  let reg: RegExp;
  switch (type) {
    case SyntaxType.KEYWORD:
      reg = /(^|\s)BOTTOM\s+((\d+)(:(-?\d+))?)/i;
      break;
    case SyntaxType.TRADITIONAL:
      reg = /(^|\s)-BOTTOM\s+((\d+)(:(-?\d+))?)/i;
      break;
    case SyntaxType.SLASH:
      reg = /(^|\s)((\d+)(:(-?\d+))?)/i;
      break;
  }
  return reg;
}

export const BOTTOM_PATTERN: Pattern<'BOTTOM'> = {
  name: 'BOTTOM',
  details: 'Indicates to fetch the range of tracks starting from the end of the list.',
  permission: UserPermission.User,
  usage: [
    '100  # Get the last 100 songs',
    '4:10  # Get the 4th last song to the 10th last song',
    '5:-5  # Get the 5th last song to the 5th first song',
  ],
  priority: 2,
  ex: text => new RangeExample(text, 'bottom'),
  matchText: (text, type) => {
    const reg = getBottomPatternReg(type);
    const match = matchText(text, reg);
    let args: RangeArgument | undefined;
    if (match.matches && match.args && match.args.length >= 5) {
      args = { start: +match.args[2] };
      if (match.args[3]) args.stop = +match.args[4];
    }
    return { matches: match.matches, newText: match.newText, args };
  },
};
