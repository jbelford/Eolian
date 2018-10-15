import { LinkCommand } from "commands/account/link";
import { UnlinkCommand } from "commands/account/unlink";

export const AccountCommands: Command[] = [
  LinkCommand,
  UnlinkCommand
];