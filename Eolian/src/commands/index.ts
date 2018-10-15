import { AccountCommands } from "commands/account/index";
import { GeneralCommands } from "commands/general/index";

export const COMMANDS: Command[] = GeneralCommands
  .concat(AccountCommands);