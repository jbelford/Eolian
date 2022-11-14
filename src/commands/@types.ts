import { UserPermission } from '@eolian/common/constants';
import { ContextClient, ContextCommandInteraction } from '@eolian/framework/@types';
import { ServerState } from '@eolian/framework/state/@types';
import {
  Pattern,
  CommandOptions,
  Keyword,
  ArgumentExample,
  SyntaxType,
  KeywordGroup,
} from '@eolian/command-options/@types';

export interface BaseCommand {
  name: string;
  permission: UserPermission;
  patterns?: Pattern[];
  patternsGrouped?: Map<KeywordGroup, Pattern[]>;
  dmAllowed?: boolean;
  noDefaultReply?: boolean;
  execute(context: CommandContext, options: CommandOptions): Promise<void>;
}

export interface OwnerCommand {
  name: string;
  numArgs: number;
  execute(context: CommandContext, args: string[]): Promise<void>;
}

export type CommandArgOption = {
  name: string;
  details: string;
  getChoices?: () => string[];
};

export type CommandArgGroup = {
  required: boolean;
  options: CommandArgOption[];
};

export type CommandArgs = {
  base: boolean;
  groups: CommandArgGroup[];
};

export interface Command extends BaseCommand {
  shortDetails?: string;
  shortName?: string;
  details: string;
  category: CommandCategory;
  keywords?: Keyword[];
  keywordSet?: Set<string>;
  new?: boolean;
  usage: CommandUsage[];
  /**
   * Command doesn't use keywords/patterns
   */
  args?: CommandArgs;
}

export type MessageCommand = BaseCommand;

export interface CommandUsage {
  title?: string;
  example: ArgumentExample[] | string;
  hide?: boolean;
}

export interface CommandCategory {
  name: string;
  details: string;
  permission: UserPermission;
}

export interface CommandParsingStrategy {
  messageInvokesBot(message: string, prefix?: string): boolean;
  parseCommand(message: string, permission: UserPermission, type?: SyntaxType): ParsedCommand;
}

export interface ParsedCommand {
  command: BaseCommand;
  options: CommandOptions;
}

export interface CommandContext {
  client: ContextClient;
  interaction: ContextCommandInteraction;
  server?: ServerState;
}

export interface ICommandStore<T extends BaseCommand> {
  readonly list: T[];
  get(name: string): T | undefined;
  safeGet(name: string, permission: UserPermission): T;
}
