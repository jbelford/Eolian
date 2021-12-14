import { COMMAND_MAP, MESSAGE_COMMAND_MAP } from 'commands';
import { PERMISSION } from 'common/constants';
import { environment } from 'common/env';
import { EolianUserError } from 'common/errors';
import { BaseCommand, Command, CommandOptions, CommandOptionsParsingStrategy, CommandParsingStrategy, MessageCommand, ParsedCommand, SyntaxType } from './@types';
import { KEYWORDS, PATTERNS, PATTERNS_SORTED } from './keywords';

export function simpleOptionsStrategy(text: string): CommandOptions {
  const options: CommandOptions = {};
  if (text.trim().length > 0) {
    options.ARG = text.trim().split(' ');
  }
  return options;
}

function keywordOptionsStrategy(text: string, permission: PERMISSION, keywords: string[] = [], patterns: string[] = []): CommandOptions {
  const keywordSet = new Set<string>(keywords);
  const patternSet = new Set<string>(patterns);

  const options: CommandOptions = {};
  for (const pattern of PATTERNS_SORTED) {
    if (pattern!.permission <= permission && patternSet.has(pattern!.name)) {
      const result = pattern!.matchText(text, SyntaxType.KEYWORD);
      if (result.matches) {
        options[pattern!.name] = result.args;
        text = result.newText;
      }
    }
  }

  const split = new Set<string>(text.toLowerCase().split(/\s+/));

  for (const keyword of Object.values(KEYWORDS)) {
    if (keyword!.permission <= permission && split.has(keyword!.name.toLowerCase())) {
      if (keywordSet.has(keyword!.name)) {
        options[keyword!.name] = true;
      } else {
        throw new EolianUserError(`This command does not accept the \`${keyword!.name}\` keyword. Try again without it.`);
      }
    }
  }

  return options;
}

function traditionalOptionsStrategy(text: string, permission: PERMISSION, keywords: string[] = [], patterns: string[] = []): CommandOptions {
  const keywordSet = new Set<string>(keywords);
  const patternSet = new Set<string>(patterns);

  const options: CommandOptions = {};
  for (const pattern of PATTERNS_SORTED) {
    if (pattern!.permission <= permission && patternSet.has(pattern!.name) && pattern!.name !== PATTERNS.SEARCH.name) {
      const result = pattern!.matchText(text, SyntaxType.TRADITIONAL);
      if (result.matches) {
        options[pattern!.name] = result.args;
        text = result.newText;
      }
    }
  }

  const reg = /(^|\s)-(?<keyword>\w+)/g;
  for (const match of text.matchAll(reg)) {
    if (match.groups) {
      const name = match.groups['keyword'].toUpperCase();
      const keyword = KEYWORDS[name];
      if (keyword) {
        if (keywordSet.has(keyword.name)) {
          options[keyword.name] = true;
        } else {
          throw new EolianUserError(`This command does not accept the \`${keyword.name}\` keyword. Try again without it.`);
        }
      } else {
        throw new EolianUserError(`Unrecognized keyword \`${name}\`. Try again.`);
      }
    }
  }
  text = text.replace(reg, '').trim();

  if (patternSet.has(PATTERNS.SEARCH.name) && text.length) {
    options.SEARCH = text;
  }

  return options;
}

function getCommandOptionParsingStrategy(command: Command, type: SyntaxType): CommandOptionsParsingStrategy {
  return command.keywords || command.patterns
    ? type === SyntaxType.KEYWORD ? keywordOptionsStrategy : traditionalOptionsStrategy
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

    const command = getCommand(commandName, permission);

    const optionParsingFn = getCommandOptionParsingStrategy(command, type);
    const options = optionParsingFn(text, permission, command.keywords?.map(keyword => keyword.name), command.patterns?.map(pattern => pattern.name));

    return { command, options };
  }

}

export function getCommand(commandName: string, permission: PERMISSION): Command {
  const command = COMMAND_MAP[commandName];
  return checkCommand(command, commandName, permission);
}

export function getMessageCommand(commandName: string, permission: PERMISSION): MessageCommand {
  const command = MESSAGE_COMMAND_MAP[commandName];
  return checkCommand(command, commandName, permission);
}

function checkCommand<T extends BaseCommand>(command: T | undefined, commandName: string, permission: PERMISSION): T {
  if (!command) {
    throw new EolianUserError(`There is no command \`${commandName}\``);
  } else if (command.permission > permission) {
    throw new EolianUserError('You do not have permission to use this command');
  }
  return command;
}

export function createCommandParsingStrategy(): CommandParsingStrategy {
  return new KeywordParsingStrategy();
}
