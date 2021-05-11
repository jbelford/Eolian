import { Command } from 'commands/@types';
import { ADD_COMMAND } from './add';
import { QUEUE_COMMAND } from './queue';
import { REMOVE_COMMAND } from './remove';

export const QUEUE_COMMANDS: Command[] = [
  ADD_COMMAND,
  REMOVE_COMMAND,
  QUEUE_COMMAND
];