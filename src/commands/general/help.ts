import { COMMAND_MAP } from 'commands';
import { Command, CommandContext, CommandOptions, SyntaxType } from 'commands/@types';
import { COMMAND_CATEGORIES, GENERAL_CATEGORY } from 'commands/category';
import { KEYWORDS, PATTERNS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { createCategoryListEmbed, createCommandDetailsEmbed, createCommandListEmbed, createKeywordDetailsEmbed, createPatternDetailsEmbed } from 'embed';

async function execute({ user, channel, server }: CommandContext, { ARG }: CommandOptions): Promise<void> {
  if (!ARG) {
    const categories = COMMAND_CATEGORIES.filter(category => category.permission <= user.permission);
    const config = await server?.details.get();
    const categoryListEmbed = createCategoryListEmbed(categories, config?.prefix);
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

  let type = SyntaxType.KEYWORD;
  if (server) {
    const details = await server.details.get();
    type = details.syntax ?? SyntaxType.KEYWORD;
  }

  const command = COMMAND_MAP[arg];
  if (command && command.permission <= user.permission) {
    const commandEmbed = createCommandDetailsEmbed(command, type);
    await channel.sendEmbed(commandEmbed);
    return;
  }

  const keyword = KEYWORDS[arg.toUpperCase()];
  if (keyword && keyword.permission <= user.permission) {
    const keywordEmbed = createKeywordDetailsEmbed(keyword, type);
    await channel.sendEmbed(keywordEmbed);
    return;
  }

  const pattern = PATTERNS[arg.toUpperCase()];
  if (pattern && pattern.permission <= user.permission) {
    const patternEmbed = createPatternDetailsEmbed(pattern, type);
    await channel.sendEmbed(patternEmbed);
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