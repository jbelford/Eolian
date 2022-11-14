import { ParsedCommand, CommandArgs } from '@eolian/commands/@types';
import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { UsersDb } from '@eolian/data/@types';
import { CommandOptionBuilder, KEYWORDS, PATTERNS } from '@eolian/command-options';
import {
  CommandOptions,
  Keyword,
  KeywordGroup,
  Pattern,
  SyntaxType,
} from '@eolian/command-options/@types';
import { ChatInputCommandInteraction } from 'discord.js';
import { ContextCommandInteraction, IAuthServiceProvider } from '../@types';
import { ButtonRegistry } from '../button-registry';
import { DiscordInteraction } from './discord-interaction';
import { COMMANDS } from '@eolian/commands';

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
  const command = COMMANDS.safeGet(interaction.commandName, permission);

  const builder = new CommandOptionBuilder(permission, SyntaxType.SLASH);
  let options: CommandOptions = {};
  if (command.keywords || command.patterns) {
    const groupSet = new Set<string>();

    command.keywords
      ?.map(keyword => getKeyword(keyword, groupSet, interaction))
      .forEach(keyword => keyword && builder.withKeyword(keyword));

    if (command.patternsGrouped) {
      parseGroupPatterns(builder, command.patternsGrouped, interaction);
    }

    command.patterns
      ?.filter(pattern => !pattern.group)
      .forEach(pattern => parseSlashPattern(builder, pattern, interaction, command.args));

    options = builder.get();
  } else if (command.args) {
    options.ARG = parseCommandArgs(command.args, interaction);
  } else {
    builder.withTextArgs(interaction.options.getString('args', false) ?? '');
    options = builder.get();
  }

  return { command, options };
}

function getKeyword(
  keyword: Keyword,
  groupSet: Set<string>,
  interaction: ChatInputCommandInteraction
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
  return found;
}

function parseSlashPattern(
  builder: CommandOptionBuilder,
  pattern: Pattern,
  interaction: ChatInputCommandInteraction,
  args?: CommandArgs
) {
  if (args && pattern.name === PATTERNS.ARG.name) {
    builder.withArgs(parseCommandArgs(args, interaction));
  } else {
    const text = interaction.options.getString(pattern.name.toLowerCase());
    if (text) {
      builder.withPattern(pattern, text, true);
    }
  }
}

function parseGroupPatterns(
  builder: CommandOptionBuilder,
  patternGroups: Map<KeywordGroup, Pattern[]>,
  interaction: ChatInputCommandInteraction
) {
  for (const [group, patterns] of patternGroups) {
    const text = interaction.options.getString(group);
    if (text) {
      builder.withPatterns(patterns, text);
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
