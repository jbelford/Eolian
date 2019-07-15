import { AccountCommand } from './account';
import { IdentifyCommand } from './identify';
import { LinkCommand } from './link';
import { UnlinkCommand } from './unlink';

export const AccountCommands: Command[] = [
  AccountCommand,
  IdentifyCommand,
  LinkCommand,
  UnlinkCommand
];