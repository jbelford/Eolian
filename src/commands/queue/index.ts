import { Command } from '../@types';
import { ADD_COMMAND } from './add-command';
import { LIST_COMMAND } from './list-command';
import { LOOP_COMMAND } from './loop-command';
import { MOVE_COMMAND } from './move-command';
import { REMOVE_COMMAND } from './remove-command';

export const QUEUE_COMMANDS: Command[] = [
  ADD_COMMAND,
  REMOVE_COMMAND,
  MOVE_COMMAND,
  LIST_COMMAND,
  LOOP_COMMAND,
];

export { ADD_MESSAGE_COMMAND } from './add-command';
