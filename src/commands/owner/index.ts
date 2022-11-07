import { OwnerCommand } from '../@types';
import { KICK_COMMAND, KICK_OLD_COMMAND, KICK_UNUSED_COMMAND } from './kick';
import { UPDATE_SLASH_COMMAND } from './update';

export const OWNER_COMMANDS: Map<OwnerCommand['name'], OwnerCommand> = new Map(
  [KICK_COMMAND, KICK_OLD_COMMAND, KICK_UNUSED_COMMAND, UPDATE_SLASH_COMMAND].map(command => [
    command.name,
    command,
  ])
);
