import { OwnerCommand } from '../@types';
import { KICK_COMMAND } from './kick-command';
import { KICK_OLD_COMMAND } from './kick-old-command';
import { KICK_UNUSED_COMMAND } from './kick-unused-command';
import { UPDATE_SLASH_COMMAND } from './update-slash-command';

export const OWNER_COMMANDS: Map<OwnerCommand['name'], OwnerCommand> = new Map(
  [KICK_COMMAND, KICK_OLD_COMMAND, KICK_UNUSED_COMMAND, UPDATE_SLASH_COMMAND].map(command => [
    command.name,
    command,
  ]),
);
