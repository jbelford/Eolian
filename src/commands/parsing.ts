import { COMMAND_MAP } from 'commands';
import { KEYWORDS_SORTED } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { environment } from 'common/env';
import { EolianUserError } from 'common/errors';
import { Command, CommandOptions, CommandOptionsParsingStrategy, CommandParsingStrategy, ParsedCommand } from './@types';

function simpleOptionsStrategy(text: string): CommandOptions {
  const options: CommandOptions = {};
  if (text.trim().length > 0) {
    options.ARG = text.trim().split(' ');
  }
  return options;
}

function keywordOptionsStrategy(text: string, permission: PERMISSION, keywords: string[] = []): CommandOptions {
  const keywordSet = new Set<string>(keywords);
  return KEYWORDS_SORTED.filter(keyword => keywordSet.has(keyword.name) && keyword.permission <= permission)
    .reduce((options, keyword) => {
      const result = keyword.matchText(text);
      if (result.matches) {
        options[keyword.name] = result.args;
        text = result.newText;
      }
      return options;
    }, {} as CommandOptions);
}

function getCommandOptionParsingStrategy(command: Command): CommandOptionsParsingStrategy {
  return command.keywords ? keywordOptionsStrategy : simpleOptionsStrategy;
}

class KeywordParsingStrategy implements CommandParsingStrategy {

  messageInvokesBot(message: string, prefix = environment.cmdToken): boolean {
    return message.trim().charAt(0) === prefix;
  }

  parseCommand(message: string, permission: PERMISSION): ParsedCommand {
    let text = message.trim();

    const textSplit = text.split(/\s+/g);
    const commandName = textSplit[0].toLowerCase();

    text = textSplit.slice(1).join(' ');

    const command = COMMAND_MAP[commandName];
    if (!command) {
      throw new EolianUserError(`There is no command \`${commandName}\``);
    }

    const optionParsingFn = getCommandOptionParsingStrategy(command);
    const options = optionParsingFn(text, permission, command.keywords?.map(keyword => keyword.name));

    return { command, options };
  }

}

export function createCommandParsingStrategy(): CommandParsingStrategy {
  return new KeywordParsingStrategy();
}

