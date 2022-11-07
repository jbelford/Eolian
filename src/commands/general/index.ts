import { Command } from '../@types';
import { HELP_COMMAND } from './help-command';
import { INVITE_COMMAND } from './invite-command';
import { POLL_COMMAND } from './poll-command';
import { SERVERS_COMMAND } from './servers-command';

export const GENERAL_COMMANDS: Command[] = [
  HELP_COMMAND,
  INVITE_COMMAND,
  POLL_COMMAND,
  SERVERS_COMMAND,
];
