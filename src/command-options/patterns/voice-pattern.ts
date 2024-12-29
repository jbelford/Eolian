import { UserPermission } from '@eolian/common/constants';
import { Pattern, SyntaxType } from '../@types';
import { matchText, RangeExample } from './patterns-utils';

function getVoicePatternReg(type: SyntaxType) {
  let reg: RegExp;
  switch (type) {
    case SyntaxType.KEYWORD:
      reg = /(^|\s)VOICE\s+(\d+)/i;
      break;
    case SyntaxType.TRADITIONAL:
      reg = /(^|\s)-VOICE\s+(\d+)/i;
      break;
    case SyntaxType.SLASH:
      reg = /(^|\s)(\d+)/i;
      break;
  }
  return reg;
}

export const VOICE_PATTERN: Pattern<'VOICE'> = {
  name: 'VOICE',
  details: 'Indicates which voice to use for AI audio generation.',
  permission: UserPermission.User,
  usage: ['1  # Use the first voice', '2  # Use the second voice'],
  priority: 2,
  ex: text => new RangeExample(text, 'voice'),
  matchText(text, type) {
    const reg = getVoicePatternReg(type);
    const match = matchText(text, reg);
    let args: number | undefined;
    if (match.matches && match.args && match.args.length >= 3) {
      args = +match.args[1];
    }
    return { matches: match.matches, newText: match.newText, args };
  },
};
