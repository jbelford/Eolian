import { Command } from './@types';
import { ACCOUNT_COMMANDS } from './account';
import { GENERAL_COMMANDS } from './general';
import { MUSIC_COMMANDS } from './music';
import { QUEUE_COMMANDS } from './queue';

export const COMMANDS: Command[] = GENERAL_COMMANDS
  .concat(ACCOUNT_COMMANDS)
  .concat(QUEUE_COMMANDS)
  .concat(MUSIC_COMMANDS);

export const COMMAND_MAP = COMMANDS.reduce((obj, command) => {
  obj[command.name] = command;
  return obj;
}, {} as { [key:string]: Command | undefined });

export * from './parsing';

