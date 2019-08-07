import { COMMANDS } from 'commands';
import { BotServices, Command, CommandAction, CommandContext, CommandOptions } from 'commands/@types';
import { COMMAND_CATEGORIES, GENERAL_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { createCategoryListEmbed, createCommandDetailsEmbed, createCommandListEmbed, createKeywordDetailsEmbed } from 'embed';

/**
 * Sends a help message for commands and categories based on user arguments.
 */
class HelpAction implements CommandAction {

  constructor(private readonly services: BotServices) {}

  async execute({ user, channel, message }: CommandContext, { ARG }: CommandOptions): Promise<void> {
    if (!ARG) {
      const categoryListEmbed = createCategoryListEmbed(COMMAND_CATEGORIES);
      await channel.sendEmbed(categoryListEmbed);
      return;
    }

    const arg = ARG[0].toLowerCase();

    let idx = +arg;
    if (!isNaN(idx)) {
      if (idx < 1 || idx > COMMAND_CATEGORIES.length) {
        await message.reply('No category at that index! Please try again.');
        return;
      }
      idx--;
    }

    const category = !isNaN(idx) && idx >= 0 && idx < COMMAND_CATEGORIES.length
      ? COMMAND_CATEGORIES[idx] : COMMAND_CATEGORIES.find(category => category.name.toLowerCase() === arg);
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

    await channel.send(`Sorry! I don't think anything is referred to as \`${arg}\``);
  }

}

export const HELP_COMMAND: Command = {
  name: 'help',
  details: 'Shows list of all available categories, commands, keywords, and their details',
  permission: PERMISSION.USER,
  category: GENERAL_CATEGORY,
  keywords: [KEYWORDS.ARG],
  usage: ['', '/General/', '/poll/', '/spotify/', '/arg/', '/ARG/  # Everything is case insensitive',],
  createAction: services => new HelpAction(services)
}