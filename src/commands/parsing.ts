import { COMMAND_MAP } from 'commands';
import { PERMISSION } from 'common/constants';
import { environment } from 'common/env';
import { EolianUserError } from 'common/errors';
import { Command, CommandOptions, CommandOptionsParsingStrategy, CommandParsingStrategy, ParsedCommand, SyntaxType } from './@types';
import { KEYWORDS, PATTERNS, PATTERNS_SORTED } from './keywords';

function simpleOptionsStrategy(text: string): CommandOptions {
  const options: CommandOptions = {};
  if (text.trim().length > 0) {
    options.ARG = text.trim().split(' ');
  }
  return options;
}

function keywordOptionsStrategy(text: string, permission: PERMISSION, keywords: string[] = [], patterns: string[] = []): CommandOptions {
  const keywordSet = new Set<string>(keywords);
  const patternSet = new Set<string>(patterns);

  const options = PATTERNS_SORTED.filter(pattern => patternSet.has(pattern!.name) && pattern!.permission <= permission)
    .reduce((options, pattern) => {
      const result = pattern!.matchText(text, SyntaxType.KEYWORD);
      if (result.matches) {
        options[pattern!.name] = result.args;
        text = result.newText;
      }
      return options;
    }, {} as CommandOptions);

  const split = new Set<string>(text.toLowerCase().split(/\s+/));

  Object.values(KEYWORDS)
    .filter(keyword => keywordSet.has(keyword!.name) && keyword!.permission <= permission && split.has(keyword!.name.toLowerCase()))
    .forEach(keyword => {
      options[keyword!.name] = true;
    });

  return options;
}

function bashKeywordOptionsStrategy(text: string, permission: PERMISSION, keywords: string[] = [], patterns: string[] = []): CommandOptions {
  const keywordSet = new Set<string>(keywords);
  const patternSet = new Set<string>(patterns);

  const options = PATTERNS_SORTED.filter(pattern => patternSet.has(pattern!.name) && pattern!.name !== PATTERNS.SEARCH.name && pattern!.permission <= permission)
    .reduce((options, pattern) => {
      const result = pattern!.matchText(text, SyntaxType.TRADITIONAL);
      if (result.matches) {
        options[pattern!.name] = result.args;
        text = result.newText;
      }
      return options;
    }, {} as CommandOptions);

  const reg = /(^|\s)-(?<keyword>\w+)/g
  for (const match of text.matchAll(reg)) {
    if (match.groups) {
      const name = match.groups['keyword'].toUpperCase();
      const keyword = KEYWORDS[name];
      if (keyword && keywordSet.has(keyword.name)) {
        options[keyword.name] = true;
      }
    }
  }
  text = text.replace(reg, '').trim();

  if (patternSet.has(PATTERNS.SEARCH.name)) {
    options.SEARCH = text;
  }

  return options;
}

function getCommandOptionParsingStrategy(command: Command, type: SyntaxType): CommandOptionsParsingStrategy {
  return command.keywords || command.patterns
    ? type === SyntaxType.KEYWORD ? keywordOptionsStrategy : bashKeywordOptionsStrategy
    : simpleOptionsStrategy;
}

class KeywordParsingStrategy implements CommandParsingStrategy {

  messageInvokesBot(message: string, prefix = environment.cmdToken): boolean {
    return message.trim().charAt(0) === prefix;
  }

  parseCommand(message: string, permission: PERMISSION, type = SyntaxType.KEYWORD): ParsedCommand {
    let text = message.trim();

    const textSplit = text.split(/\s+/g);
    const commandName = textSplit[0].toLowerCase();

    text = textSplit.slice(1).join(' ');

    const command = COMMAND_MAP[commandName];
    if (!command) {
      throw new EolianUserError(`There is no command \`${commandName}\``);
    }

    const optionParsingFn = getCommandOptionParsingStrategy(command, type);
    const options = optionParsingFn(text, permission, command.keywords?.map(keyword => keyword.name), command.patterns?.map(pattern => pattern.name));

    return { command, options };
  }

}

export function createCommandParsingStrategy(): CommandParsingStrategy {
  return new KeywordParsingStrategy();
}
