import { COMMAND_MAP } from 'commands';
import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { COMMAND_CATEGORIES, GENERAL_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { createCategoryListEmbed, createCommandDetailsEmbed, createCommandListEmbed, createKeywordDetailsEmbed } from 'embed';

async function execute({ user, channel }: CommandContext, { ARG }: CommandOptions): Promise<void> {
  if (!ARG) {
    const categoryListEmbed = createCategoryListEmbed(COMMAND_CATEGORIES);
    await channel.sendEmbed(categoryListEmbed);
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

  const category = !isNaN(idx) && idx >= 0 && idx < COMMAND_CATEGORIES.length
      ? COMMAND_CATEGORIES[idx]
      : COMMAND_CATEGORIES.find(category => category.name.toLowerCase() === arg);
  if (category) {
    const commandListEmbed = createCommandListEmbed(category, user.permission);
    await channel.sendEmbed(commandListEmbed);
    return;
  }

  const command = COMMAND_MAP[arg];
  if (command && command.permission <= user.permission) {
    const commandEmbed = createCommandDetailsEmbed(command);
    await channel.sendEmbed(commandEmbed);
    return;
  }

  const keyword = KEYWORDS[arg.toUpperCase()];
  if (keyword && keyword.permission <= user.permission) {
    const keywordEmbed = createKeywordDetailsEmbed(keyword);
    await channel.sendEmbed(keywordEmbed);
    return;
  }

  throw new EolianUserError(`Sorry! I don't think anything is referred to as \`${arg}\``);
}

export const HELP_COMMAND: Command = {
  name: 'help',
  details: 'Shows list of all available categories, commands, keywords, and their details',
  permission: PERMISSION.USER,
  category: GENERAL_CATEGORY,
  dmAllowed: true,
  usage: [
    {
      title: 'Get list of categories',
      example: '',
    },
    {
      title: 'Show commands for first category',
      example: '1',
    },
    {
      title: `Show commands for 'General' category`,
      example: 'General'
    },
    {
      title: `Show help for 'poll' command`,
      example: 'poll'
    },
    {
      title: `Show help for SPOTIFY keyword`,
      example: 'spotify'
    },
    {
      title: `Show help for QUERY pattern`,
      example: 'query'
    }
  ],
  execute
}