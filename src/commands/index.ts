import { AccountCommands } from "commands/account/index";
import { GeneralCommands } from "commands/general/index";
import { QueueCommands } from "./queue";

export const COMMANDS: Command[] = GeneralCommands
  .concat(AccountCommands)
  .concat(QueueCommands);