import { UserPermission } from '@eolian/common/constants';
import { ArgumentExample, SyntaxType, Pattern } from '../@types';
import { matchGroup } from './patterns-utils';

const name = 'IDENTIFIER';

class IdentifierExample implements ArgumentExample {
  constructor(private readonly _text: string) {}

  text(type: SyntaxType): string {
    return type === SyntaxType.SLASH ? `${name}:${this._text}` : `[${this._text}]`;
  }
}

export const IDENTIFIER_PATTERN: Pattern<'IDENTIFIER'> = {
  name,
  details: 'Used for referring to an identifier (a shortcut) for some resource such as a playlist.',
  permission: UserPermission.User,
  usage: ['my identifier', 'music playlist #2'],
  priority: 5,
  ex: text => new IdentifierExample(text),
  matchText: (text: string, type: SyntaxType) =>
    type === SyntaxType.SLASH
      ? { matches: true, newText: '', args: text.trim() }
      : matchGroup(text, /\B\[\s*(.*[^\s])\s*\]\B/i, 0),
};
