import { Command } from '../@types';
import { ME_COMMAND } from './me-command';
import { IDENTIFY_COMMAND } from './identify-command';
import { LINK_COMMAND } from './link-command';
import { UNLINK_COMMAND } from './unlink-command';
import { SYNTAX_COMMAND } from './syntax-command';

export const ACCOUNT_COMMANDS: Command[] = [
  ME_COMMAND,
  IDENTIFY_COMMAND,
  LINK_COMMAND,
  UNLINK_COMMAND,
  SYNTAX_COMMAND,
];
