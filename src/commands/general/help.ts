import { COMMANDS } from 'commands';
import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { COMMAND_CATEGORIES, GENERAL_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { createCategoryListEmbed, createCommandDetailsEmbed, createCommandListEmbed, createKeywordDetailsEmbed } from 'embed';

async function execute({ user, channel, message }: CommandContext, { ARG }: CommandOptions): Promise<void> {
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
    const commandListEmbed = createCommandListEmbed(category);
    await channel.sendEmbed(commandListEmbed);
    return;
  }

  const command = COMMANDS.find(cmd => cmd.name.toLowerCase() === arg);
  if (command) {
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
  keywords: [KEYWORDS.ARG],
  usage: ['', '/General/', '/poll/', '/spotify/', '/arg/', '/ARG/  # Everything is case insensitive',],
  execute
}