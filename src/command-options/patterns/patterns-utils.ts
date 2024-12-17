import { ArgumentExample, SyntaxType, PatternMatchResult } from '../@types';

export class PassthroughExample implements ArgumentExample {
  constructor(
    private readonly name: string,
    private readonly _text: string,
  ) {}

  text(type: SyntaxType): string {
    if (type === SyntaxType.SLASH) {
      return `${this.name.toLowerCase()}:${this._text}`;
    }
    return this._text;
  }
}

export class RangeExample implements ArgumentExample {
  constructor(
    private readonly _text: string,
    private readonly name: string,
  ) {}

  text(type: SyntaxType): string {
    switch (type) {
      case SyntaxType.KEYWORD:
        return `${this.name} ${this._text}`;
      case SyntaxType.TRADITIONAL:
        return `-${this.name} ${this._text}`;
      case SyntaxType.SLASH:
        return `${this.name}:${this._text}`;
      default:
        throw new Error(`Unknown syntax type ${type}!`);
    }
  }
}

export function matchText(text: string, reg: RegExp): PatternMatchResult<string[]> {
  const regArr = reg.exec(text);
  const match: PatternMatchResult<string[]> = { matches: !!regArr, newText: text.replace(reg, '') };
  if (regArr) {
    match.args = regArr.slice(1).map(group => group && group.trim());
  }
  return match;
}

export function matchGroup(text: string, reg: RegExp, group: number): PatternMatchResult<string> {
  const match = matchText(text, reg);
  let args: string | undefined;
  if (match.matches && match.args) {
    args = match.args[group];
    if (reg.ignoreCase) {
      args = args.toLowerCase();
    }
  }
  return { matches: match.matches, newText: match.newText, args };
}
