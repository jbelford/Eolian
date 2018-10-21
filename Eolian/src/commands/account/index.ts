import { LinkCommand } from "commands/account/link";
import { UnlinkCommand } from "commands/account/unlink";
import { IdentifyCommand } from "./identify";

export const AccountCommands: Command[] = [
  LinkCommand,
  UnlinkCommand,
  IdentifyCommand
];