import { LinkCommand } from "commands/account/link";
import { UnlinkCommand } from "commands/account/unlink";
import { AccountCommand } from "./account";
import { IdentifyCommand } from "./identify";

export const AccountCommands: Command[] = [
  LinkCommand,
  UnlinkCommand,
  IdentifyCommand,
  AccountCommand
];