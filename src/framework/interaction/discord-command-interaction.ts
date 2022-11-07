import {
  checkSetKeyword,
  getCommand,
  matchPatterns,
  patternMatch,
  simpleOptionsStrategy,
} from '@eolian/commands';
import {
  CommandArgs,
  CommandOptions,
  Keyword,
  ParsedCommand,
  Pattern,
  SyntaxType,
} from '@eolian/commands/@types';
import { KEYWORDS } from '@eolian/commands/keywords';
import { PATTERNS } from '@eolian/commands/patterns';
import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { UsersDb } from '@eolian/data/@types';
import { ChatInputCommandInteraction } from 'discord.js';
import { ContextCommandInteraction, IAuthServiceProvider } from '../@types';
import { ButtonRegistry } from '../button-registry';
import { DiscordInteraction } from './discord-interaction';

export class DiscordCommandInteraction
  extends DiscordInteraction<ChatInputCommandInteraction>
  implements ContextCommandInteraction
{

  readonly isSlash = true;

  constructor(
    interaction: ChatInputCommandInteraction,
    registry: ButtonRegistry,
    users: UsersDb,
    auth: IAuthServiceProvider
  ) {
    super(interaction, registry, users, auth);
  }

  get content(): string {
    return this.interaction.toString();
  }

  get reactable(): boolean {
    return false;
  }

  async react(): Promise<void> {
    // Do nothing since we can't react to slash commands
  }

  async getCommand(): Promise<ParsedCommand> {
    return parseSlashCommand(this.interaction, this.user.permission);
  }

  toString(): string {
    return this.interaction.toString();
  }

}

export function parseSlashCommand(
  interaction: ChatInputCommandInteraction,
  permission: UserPermission
): ParsedCommand {
  const command = getCommand(interaction.commandName, permission);

  let options: CommandOptions = {};
  if (command.keywords || command.patterns) {
    const groupSet = new Set<string>();
    const patternSet = new Set<string>(command.patterns?.map(p => p.name));

    command.keywords?.forEach(keyword =>
      parseSlashKeyword(keyword, permission, interaction, options, groupSet)
    );
    command.patterns?.forEach(pattern =>
      parseSlashPattern(
        pattern,
        permission,
        interaction,
        options,
        patternSet,
        groupSet,
        command.args
      )
    );
  } else if (command.args) {
    options.ARG = parseCommandArgs(command.args, interaction);
  } else {
    options = simpleOptionsStrategy(interaction.options.getString('args', false) ?? '');
  }

  return { command, options };
}

function parseSlashKeyword(
  keyword: Keyword,
  permission: UserPermission,
  interaction: ChatInputCommandInteraction,
  options: CommandOptions,
  groupSet: Set<string>
) {
  let found: Keyword | undefined;
  if (keyword.group) {
    if (!groupSet.has(keyword.group)) {
      const value = interaction.options.getString(keyword.group) ?? '';
      found = KEYWORDS[value.toUpperCase()];
      groupSet.add(keyword.group);
    }
  } else if (interaction.options.getBoolean(keyword.name.toLowerCase())) {
    found = keyword;
  }
  if (found) {
    checkSetKeyword(found, permission, options);
  }
}

function parseSlashPattern(
  pattern: Pattern,
  permission: UserPermission,
  interaction: ChatInputCommandInteraction,
  options: CommandOptions,
  patternSet: Set<string>,
  groupSet: Set<string>,
  args?: CommandArgs
) {
  if (args && pattern.name === PATTERNS.ARG.name) {
    options.ARG = parseCommandArgs(args, interaction);
  } else if (pattern.group) {
    if (!groupSet.has(pattern.group)) {
      const text = interaction.options.getString(pattern.group);
      if (text) {
        matchPatterns(text, permission, patternSet, options, pattern.group);
      }
      groupSet.add(pattern.group);
    }
  } else {
    const text = interaction.options.getString(pattern.name.toLowerCase());
    if (text) {
      patternMatch(text, permission, pattern, options, SyntaxType.SLASH, true);
    }
  }
}

function parseCommandArgs(
  commandArgs: CommandArgs,
  interaction: ChatInputCommandInteraction
): string[] {
  const args = [];
  for (const group of commandArgs.groups) {
    let selectedName: string | undefined;
    let selected: string | undefined;
    for (const option of group.options) {
      const value = interaction.options.getString(option.name) ?? undefined;
      if (value) {
        if (selected) {
          throw new EolianUserError(`You can not specify both ${selectedName} & ${option.name}`);
        }
        selectedName = option.name;
        selected = value;
      }
    }
    if (selected) {
      args.push(selected);
    } else if (group.required) {
      throw new EolianUserError(
        `You must provide ${group.options.map(o => `\`${o.name}\``).join(' or ')}`
      );
    }
  }
  return args;
}
