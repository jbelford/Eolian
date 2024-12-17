import { KeywordGroup, Pattern } from '@eolian/command-options/@types';
import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { BaseCommand, Command, ICommandStore, MessageCommand } from './@types';
import { ACCOUNT_COMMANDS } from './account';
import { GENERAL_COMMANDS } from './general';
import { MUSIC_COMMANDS, PLAY_MESSAGE_COMMAND } from './music';
import { QUEUE_COMMANDS, ADD_MESSAGE_COMMAND } from './queue';
import { SETTINGS_COMMANDS } from './settings';

class CommandStore<T extends BaseCommand> implements ICommandStore<T> {
  private readonly map: Map<string, T>;

  constructor(
    readonly list: T[],
    commandKeyFn: (command: T) => string[],
  ) {
    this.map = new Map(list.flatMap(command => commandKeyFn(command).map(key => [key, command])));
  }

  safeGet(name: string, permission: UserPermission): T {
    const command = this.map.get(name);
    if (!command) {
      throw new EolianUserError(`There is no command \`${name}\``);
    } else if (command.permission > permission) {
      throw new EolianUserError('You do not have permission to use this command');
    }
    return command;
  }

  get(name: string): T | undefined {
    return this.map.get(name);
  }
}

const commands: Command[] = GENERAL_COMMANDS.concat(ACCOUNT_COMMANDS)
  .concat(QUEUE_COMMANDS)
  .concat(MUSIC_COMMANDS)
  .concat(SETTINGS_COMMANDS);

commands.forEach(command => {
  if (command.keywords) {
    command.keywordSet = new Set(command.keywords.map(keyword => keyword.name));
  }
  if (command.patterns) {
    command.patterns = command.patterns.sort((a, b) => b.priority - a.priority);
    command.patternsUngrouped = command.patterns.filter(pattern => !pattern.group);
    command.patternsGrouped = command.patterns.reduce((m, p) => {
      if (p.group) {
        const list = m.get(p.group) ?? [];
        list.push(p);
        m.set(p.group, list);
      }
      return m;
    }, new Map<KeywordGroup, Pattern[]>());
  }
});

export const COMMANDS: ICommandStore<Command> = new CommandStore(commands, command =>
  command.shortName ? [command.name, command.shortName] : [command.name],
);
export const MESSAGE_COMMANDS: ICommandStore<MessageCommand> = new CommandStore(
  [PLAY_MESSAGE_COMMAND, ADD_MESSAGE_COMMAND],
  command => [command.name],
);
