import { COMMANDS } from 'commands';
import { KEYWORDS } from 'commands/keywords';
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

function keywordOptionsStrategy(text: string, permission: PERMISSION): CommandOptions {
  const options: CommandOptions = {};

  // Extract complex keywords
  Object.values(KEYWORDS)
    .sort((a, b) => b!.priority - a!.priority)
    .filter(keyword => keyword!.permission <= permission)
    .forEach(keyword => {
      const result = keyword!.matchText(text);
      if (!result.matches) return;

      options[keyword!.name] = result.args;
      text = result.newText;
    });

  return options;
}

function getCommandOptionParsingStrategy(command: Command): CommandOptionsParsingStrategy {
  return command.keywords ? keywordOptionsStrategy : simpleOptionsStrategy;
}

class KeywordParsingStrategy implements CommandParsingStrategy {

  messageInvokesBot(message: string): boolean {
    return message.trim().charAt(0) === environment.cmdToken;
  }

  parseCommand(message: string, permission: PERMISSION): ParsedCommand {
    let text = this.messageInvokesBot(message) ? message.trim().substr(1) : message.trim();

    const textSplit = text.split(/\s+/g);
    const commandName = textSplit[0].toLowerCase();

    text = textSplit.slice(1).join(' ');

    const command = COMMANDS.find(cmd => cmd.name === commandName);
    if (!command) {
      throw new EolianUserError(`There is no command \`${commandName}\``);
    }

    const optionParsingFn = getCommandOptionParsingStrategy(command);
    const options = optionParsingFn(text, permission);

    return { command, options };
  }

}

export function createCommandParsingStrategy(): CommandParsingStrategy {
  return new KeywordParsingStrategy();
}

