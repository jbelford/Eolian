import { HelpCommand } from "commands/general/help";
import { InviteCommand } from "commands/general/invite";
import { PollCommand } from "commands/general/poll";

export const GeneralCommands: Command[] = [
  HelpCommand,
  InviteCommand,
  PollCommand
];