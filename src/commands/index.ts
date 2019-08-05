import { ACCOUNT_COMMANDS } from "commands/account/index";
import { GENERAL_COMMANDS } from "commands/general/index";
import { QUEUE_COMMANDS } from "./queue";

export const COMMANDS: Command[] = GENERAL_COMMANDS
  .concat(ACCOUNT_COMMANDS)
  .concat(QUEUE_COMMANDS);