import { AccountCommands } from "./account/index";
import { GeneralCommands } from "./general/index";

export const COMMANDS: Command[] = GeneralCommands
  .concat(AccountCommands);