import { UserPermission } from '@eolian/common/constants';
import { ArgumentExample, SyntaxType, Pattern, KeywordGroup } from '../@types';
import { matchGroup } from './patterns-utils';

class SearchExample implements ArgumentExample {
  constructor(private readonly _text: string) {}

  text(type: SyntaxType): string {
    switch (type) {
      case SyntaxType.KEYWORD:
        return `(${this._text})`;
      case SyntaxType.TRADITIONAL:
        return this._text;
      case SyntaxType.SLASH:
        return `${SEARCH_PATTERN.name}:${this._text}`;
      default:
        throw new Error(`Unknown syntax type ${type}!`);
    }
  }
}

export const SEARCH_PATTERN: Pattern<'SEARCH'> = {
  name: 'SEARCH',
  details: 'Used for searching.',
  permission: UserPermission.User,
  usage: ['what is love', 'deadmau5'],
  priority: 6,
  group: KeywordGroup.Search,
  ex: text => new SearchExample(text),
  matchText: (text: string, type: SyntaxType) =>
    type === SyntaxType.KEYWORD
      ? matchGroup(text, /\B\(\s*(.*[^\s])\s*\)\B/i, 0)
      : { matches: true, newText: '', args: text.trim() },
};
