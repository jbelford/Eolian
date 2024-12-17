import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import {
  createCategoryListEmbed,
  createCommandListEmbed,
  createCommandDetailsEmbed,
  createKeywordDetailsEmbed,
  createPatternDetailsEmbed,
} from '@eolian/embed';
import { KEYWORDS, PATTERNS, PATTERNS_SORTED } from '@eolian/command-options';
import { CommandOptions, SyntaxType } from '@eolian/command-options/@types';
import { CommandContext, CommandArgs, Command } from '../@types';
import { COMMAND_CATEGORIES, GENERAL_CATEGORY } from '../category';
import { SimpleExample } from '../simple-argument-example';
import { COMMANDS } from '../command-store';

async function execute(
  { interaction, server }: CommandContext,
  { ARG }: CommandOptions,
): Promise<void> {
  if (!ARG?.length) {
    const categories = COMMAND_CATEGORIES.filter(
      category => category.permission <= interaction.user.permission,
    );
    const config = await server?.details.get();
    const categoryListEmbed = createCategoryListEmbed(categories, config?.prefix);
    await interaction.sendEmbed(categoryListEmbed);
    return;
  }

  const arg = ARG[0].toLowerCase();

  let idx = +arg;
  if (!isNaN(idx)) {
    if (idx < 1 || idx > COMMAND_CATEGORIES.length) {
      throw new EolianUserError('No category at that index! Please try again.');
    }
    idx--;
  }

  const category =
    !isNaN(idx) && idx >= 0 && idx < COMMAND_CATEGORIES.length
      ? COMMAND_CATEGORIES[idx]
      : COMMAND_CATEGORIES.find(category => category.name.toLowerCase() === arg);
  if (category) {
    const commandListEmbed = createCommandListEmbed(category, interaction.user.permission);
    await interaction.sendEmbed(commandListEmbed);
    return;
  }

  let type = SyntaxType.KEYWORD;
  if (interaction.isSlash) {
    type = SyntaxType.SLASH;
  } else {
    const user = await interaction.user.get();
    if (user.syntax !== undefined) {
      type = user.syntax;
    } else if (server) {
      const details = await server.details.get();
      type = details.syntax ?? SyntaxType.KEYWORD;
    }
  }

  const command = COMMANDS.get(arg);
  if (
    command &&
    (command.permission < UserPermission.Admin || command.permission <= interaction.user.permission)
  ) {
    const commandEmbed = createCommandDetailsEmbed(command, type);
    await interaction.sendEmbed(commandEmbed);
    return;
  }

  const keyword = KEYWORDS[arg.toUpperCase()];
  if (
    keyword &&
    (keyword.permission < UserPermission.Admin || keyword.permission <= interaction.user.permission)
  ) {
    const keywordEmbed = createKeywordDetailsEmbed(keyword, type);
    await interaction.sendEmbed(keywordEmbed);
    return;
  }

  const pattern = PATTERNS[arg.toUpperCase()];
  if (
    pattern &&
    (pattern.permission < UserPermission.Admin || pattern.permission <= interaction.user.permission)
  ) {
    const patternEmbed = createPatternDetailsEmbed(pattern, type);
    await interaction.sendEmbed(patternEmbed);
    return;
  }

  throw new EolianUserError(`Sorry! I don't think anything is referred to as \`${arg}\``);
}

const args: CommandArgs = {
  base: true,
  groups: [
    {
      required: false,
      options: [
        {
          name: 'command',
          details: 'The command to get help for',
          getChoices() {
            return COMMANDS.list.map(cmd => cmd.name);
          },
        },
        {
          name: 'category',
          details: 'The category to get help for',
          getChoices() {
            return COMMAND_CATEGORIES.map(category => category.name);
          },
        },
        {
          name: 'keyword',
          details: 'The keyword to get help for',
          getChoices() {
            return Object.values(KEYWORDS).map(keyword => keyword!.name);
          },
        },
        {
          name: 'pattern',
          details: 'The pattern to get help for',
          getChoices() {
            return PATTERNS_SORTED.map(pattern => pattern.name);
          },
        },
      ],
    },
  ],
};

export const HELP_COMMAND: Command = {
  name: 'help',
  shortName: 'h',
  details: 'Shows list of all available categories, commands, keywords, and their details.',
  permission: UserPermission.User,
  category: GENERAL_CATEGORY,
  dmAllowed: true,
  usage: [
    {
      title: 'Get list of categories',
      example: '',
    },
    {
      title: 'Show commands for first category (legacy only)',
      example: '1',
    },
    {
      title: `Show commands for 'General' category`,
      example: SimpleExample.create(args, 'category:General'),
    },
    {
      title: `Show help for 'add' command`,
      example: SimpleExample.create(args, 'command:add'),
    },
    {
      title: `Show help for SPOTIFY keyword`,
      example: SimpleExample.create(args, 'keyword:SPOTIFY'),
    },
    {
      title: `Show help for SEARCH pattern`,
      example: SimpleExample.create(args, 'pattern:SEARCH'),
    },
  ],
  args,
  execute,
};
