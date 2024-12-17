import { CommandParsingStrategy, ParsedCommand } from '@eolian/commands/@types';
import { UserPermission } from '@eolian/common/constants';
import { environment } from '@eolian/common/env';
import { SyntaxType } from '@eolian/command-options/@types';
import { COMMANDS } from './command-store';
import { CommandOptionsParser } from '@eolian/command-options';

class TextCommandParsingStrategy implements CommandParsingStrategy {
  messageInvokesBot(message: string, prefix = environment.cmdToken): boolean {
    const trimmed = message.trim();
    if (!trimmed.startsWith(prefix)) {
      return false;
    }
    const text = trimmed.slice(1).trim();
    return text.length > 0 && !text.startsWith(prefix);
  }

  parseCommand(
    message: string,
    permission: UserPermission,
    type = SyntaxType.KEYWORD,
  ): ParsedCommand {
    let text = message.trim();

    const textSplit = text.split(/\s+/g);
    const commandName = textSplit[0].toLowerCase();

    text = textSplit.slice(1).join(' ');

    const command = COMMANDS.safeGet(commandName, permission);

    const options = new CommandOptionsParser(type).resolve(
      text,
      permission,
      command.keywordSet,
      command.patterns,
    );

    return { command, options };
  }
}

export function createCommandParsingStrategy(): CommandParsingStrategy {
  return new TextCommandParsingStrategy();
}
