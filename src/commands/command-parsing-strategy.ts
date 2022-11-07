import { COMMAND_MAP, MESSAGE_COMMAND_MAP } from '@eolian/commands';
import {
  Command,
  CommandParsingStrategy,
  ParsedCommand,
  MessageCommand,
  BaseCommand,
} from '@eolian/commands/@types';
import { UserPermission } from '@eolian/common/constants';
import { environment } from '@eolian/common/env';
import { EolianUserError } from '@eolian/common/errors';
import {
  KeywordParsingStrategy,
  TraditionalParsingStrategy,
  SimpleParsingStrategy,
} from '@eolian/command-options';
import { SyntaxType, CommandOptionsParsingStrategy } from '@eolian/command-options/@types';

function getCommandOptionParsingStrategy(
  command: Command,
  type: SyntaxType
): CommandOptionsParsingStrategy {
  return command.keywords || command.patterns
    ? type === SyntaxType.KEYWORD
      ? KeywordParsingStrategy
      : TraditionalParsingStrategy
    : SimpleParsingStrategy;
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

    const command = getCommand(commandName, permission);

    const options = getCommandOptionParsingStrategy(command, type).resolve(
      text,
      permission,
      command.keywords?.map(keyword => keyword.name),
      command.patterns?.map(pattern => pattern.name)
    );

    return { command, options };
  }

}

export function getCommand(commandName: string, permission: UserPermission): Command {
  const command = COMMAND_MAP[commandName];
  return checkCommand(command, commandName, permission);
}

export function getMessageCommand(commandName: string, permission: UserPermission): MessageCommand {
  const command = MESSAGE_COMMAND_MAP[commandName];
  return checkCommand(command, commandName, permission);
}

function checkCommand<T extends BaseCommand>(
  command: T | undefined,
  commandName: string,
  permission: UserPermission
): T {
  if (!command) {
    throw new EolianUserError(`There is no command \`${commandName}\``);
  } else if (command.permission > permission) {
    throw new EolianUserError('You do not have permission to use this command');
  }
  return command;
}

export function createCommandParsingStrategy(): CommandParsingStrategy {
  return new TextCommandParsingStrategy();
}
