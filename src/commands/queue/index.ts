import { Command } from 'commands/@types';
import { ADD_COMMAND } from './add';
import { LIST_COMMAND } from './list';
import { MOVE_COMMAND } from './move';
import { REMOVE_COMMAND } from './remove';

export const QUEUE_COMMANDS: Command[] = [
  ADD_COMMAND,
  REMOVE_COMMAND,
  MOVE_COMMAND,
  LIST_COMMAND
];