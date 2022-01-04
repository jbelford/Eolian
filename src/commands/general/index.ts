import { Command } from 'commands/@types';
import { HELP_COMMAND } from './help';
import { INVITE_COMMAND } from './invite';
import { POLL_COMMAND } from './poll';
import { SERVERS_COMMAND } from './servers';

export const GENERAL_COMMANDS: Command[] = [
  HELP_COMMAND,
  INVITE_COMMAND,
  POLL_COMMAND,
  SERVERS_COMMAND,
];
