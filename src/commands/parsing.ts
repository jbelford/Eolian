import { COMMANDS } from 'commands';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { environment } from 'common/env';
import { EolianUserError } from 'common/errors';
import { CommandOptions, CommandParsingStrategy, ParsedCommand } from './@types';

class KeywordParsingStrategy implements CommandParsingStrategy {

  messageInvokesBot(message: string): boolean {
    return message.trim().charAt(0) === environment.cmdToken;
  }

  parseCommand(message: string, permission: PERMISSION): ParsedCommand {
    let text = this.messageInvokesBot(message) ? message.trim().substr(1) : message.trim();

    const textSplit = text.toLowerCase().split(/\s+/g);
    const commandName = textSplit[0];

    text = textSplit.slice(1).join(' ');

    const command = COMMANDS.find(cmd => cmd.name === commandName);
    if (!command) {
      throw new EolianUserError(`There is no command \`${commandName}\``);
    }

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

    return { command, options };
  }

}

export function createCommandParsingStrategy(): CommandParsingStrategy {
  return new KeywordParsingStrategy();
}
