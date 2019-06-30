import HelpAction from './help';
import InviteAction from './invite';
import PollAction from './poll';

export const GeneralCommands: CommandActionConstructor[] = [
  HelpAction,
  InviteAction,
  PollAction
];