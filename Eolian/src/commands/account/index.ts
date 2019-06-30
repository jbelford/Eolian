import AccountAction from './account';
import IdentifyAction from './identify';
import LinkAction from './link';
import UnlinkAction from './unlink';

export const AccountCommands: CommandActionConstructor[] = [
  AccountAction,
  IdentifyAction,
  LinkAction,
  UnlinkAction
];