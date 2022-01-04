import { Command, MessageCommand } from './@types';
import { ACCOUNT_COMMANDS } from './account';
import { GENERAL_COMMANDS } from './general';
import { MUSIC_COMMANDS, PLAY_MESSAGE_COMMAND } from './music';
import { ADD_MESSAGE_COMMAND, QUEUE_COMMANDS } from './queue';
import { SETTINGS_COMMANDS } from './settings';

export const COMMANDS: Command[] = GENERAL_COMMANDS.concat(ACCOUNT_COMMANDS)
  .concat(QUEUE_COMMANDS)
  .concat(MUSIC_COMMANDS)
  .concat(SETTINGS_COMMANDS);

export const COMMAND_MAP = COMMANDS.reduce((obj, command) => {
  obj[command.name] = command;
  return obj;
}, {} as { [key: string]: Command | undefined });

export const MESSAGE_COMMANDS: MessageCommand[] = [PLAY_MESSAGE_COMMAND, ADD_MESSAGE_COMMAND];

export const MESSAGE_COMMAND_MAP = MESSAGE_COMMANDS.reduce((obj, command) => {
  obj[command.name] = command;
  return obj;
}, {} as { [key: string]: MessageCommand | undefined });

export * from './parsing';
