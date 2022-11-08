import {
  Command,
  CommandParsingStrategy,
  ParsedCommand,
} from '@eolian/commands/@types';
import { UserPermission } from '@eolian/common/constants';
import { environment } from '@eolian/common/env';
import {
  KeywordParsingStrategy,
  TraditionalParsingStrategy,
  SimpleParsingStrategy,
} from '@eolian/command-options';
import { SyntaxType, CommandOptionsParsingStrategy } from '@eolian/command-options/@types';
import { COMMANDS } from './command-store';

function getCommandOptionParsingStrategy(
  command: Command,
  type: SyntaxType
): CommandOptionsParsingStrategy {
  if (command.keywords || command.patterns) {
    return type === SyntaxType.KEYWORD
      ? KeywordParsingStrategy
      : TraditionalParsingStrategy;
  }
  return SimpleParsingStrategy;
}

class TextCommandParsingStrategy implements CommandParsingStrategy {

  messageInvokesBot(message: string, prefix = environment.cmdToken): boolean {
    return message.trim().charAt(0) === prefix;
  }

  parseCommand(
    message: string,
    permission: UserPermission,
    type = SyntaxType.KEYWORD
  ): ParsedCommand {
    let text = message.trim();

    const textSplit = text.split(/\s+/g);
    const commandName = textSplit[0].toLowerCase();

    text = textSplit.slice(1).join(' ');

    const command = COMMANDS.safeGet(commandName, permission);

    const options = getCommandOptionParsingStrategy(command, type).resolve(
      text,
      permission,
      command.keywords?.map(keyword => keyword.name),
      command.patterns?.map(pattern => pattern.name)
    );

    return { command, options };
  }

}

export function createCommandParsingStrategy(): CommandParsingStrategy {
  return new TextCommandParsingStrategy();
}
