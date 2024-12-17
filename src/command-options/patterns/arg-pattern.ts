import { UserPermission } from '@eolian/common/constants';
import { ArgumentExample, SyntaxType, Pattern } from '../@types';
import { matchGroup } from './patterns-utils';

const name = 'ARG';

class ArgumentPatternExample implements ArgumentExample {
  constructor(private readonly args: string[]) {}

  text(type: SyntaxType): string {
    if (type === SyntaxType.SLASH) {
      return `${name.toLowerCase()}:/ ` + this.args.join(' / ') + ' /';
    } else {
      return '/ ' + this.args.join(' / ') + ' /';
    }
  }
}

export const ARG_PATTERN: Pattern<'ARG'> = {
  name,
  details: `Used for when keywords just won't cut it.`,
  permission: UserPermission.User,
  usage: [['argument 1', 'argument 2', 'argument 3']],
  priority: 3,
  ex: (...text) => new ArgumentPatternExample(text),
  matchText: (text: string) => {
    const match = matchGroup(text, /\B\/\s*([^/]+(\/[^/]+)*)\/\B/, 0);
    return {
      matches: match.matches,
      newText: match.newText,
      args: match.args?.split(/\s*\/\s*/g),
    };
  },
};
