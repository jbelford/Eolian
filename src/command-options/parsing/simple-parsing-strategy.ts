import { CommandOptions, CommandOptionsParsingStrategy } from '../@types';

export const SimpleParsingStrategy: CommandOptionsParsingStrategy = {
  resolve(text: string): CommandOptions {
    const options: CommandOptions = {};
    if (text.trim().length > 0) {
      options.ARG = text.trim().split(' ');
    }
    return options;
  },
};
