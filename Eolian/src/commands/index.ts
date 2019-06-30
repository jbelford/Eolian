import { AccountCommands } from "commands/account/index";
import { GeneralCommands } from "commands/general/index";
import { QueueCommands } from "./queue";

export const COMMANDS: CommandActionConstructor[] = GeneralCommands
  .concat(AccountCommands)
  .concat(QueueCommands);