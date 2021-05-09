import { Command } from './@types';
import { ACCOUNT_COMMANDS } from './account';
import { GENERAL_COMMANDS } from './general';
import { MUSIC_COMMANDS } from './music';
import { QUEUE_COMMANDS } from './queue';

export const COMMANDS: Command[] = GENERAL_COMMANDS
  .concat(ACCOUNT_COMMANDS)
  .concat(QUEUE_COMMANDS)
  .concat(MUSIC_COMMANDS);

export * from './parsing';

