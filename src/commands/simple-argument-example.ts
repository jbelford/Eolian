import { ArgumentExample, SyntaxType } from '@eolian/command-options/@types';
import { CommandArgs } from './@types';

export class SimpleExample implements ArgumentExample {
  private constructor(
    private readonly name: string,
    private readonly value: string,
  ) {}

  text(type: SyntaxType): string {
    if (type === SyntaxType.SLASH) {
      return `${this.name}:${this.value}`;
    } else {
      return this.value;
    }
  }

  static create(args: CommandArgs, ...text: string[]): ArgumentExample[] {
    return text.map((arg, i) => {
      const splitResult = arg.split(':', 2);
      if (splitResult.length > 1) {
        const option = args.groups[i].options.find(option => option.name === splitResult[0]);
        if (!option) {
          throw new Error(`Missing option ${splitResult[0]}!`);
        }
        return new SimpleExample(option.name, splitResult[1]);
      } else {
        return new SimpleExample(args.groups[i].options[0].name, splitResult[0]);
      }
    });
  }
}
