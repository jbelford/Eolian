import { COMMAND_CATEGORIES, GENERAL_CATEGORY } from "commands/category";
import { COMMANDS } from "commands/index";
import { KEYWORDS } from "commands/keywords";
import { PERMISSION } from 'common/constants';
import * as embed from "embed";

const info: CommandInfo = {
  name: 'help',
  details: 'Shows list of all available categories, commands, keywords, and their details',
  permission: PERMISSION.USER,
  category: GENERAL_CATEGORY,
  keywords: [KEYWORDS.ARG],
  usage: ['', '/General/', '/poll/', '/spotify/', '/arg/', '/ARG/  # Everything is case insensitive',],
};

/**
 * Sends a help message for commands and categories based on user arguments.
 */
class HelpAction implements CommandAction {

  constructor(private readonly services: CommandActionServices) {}

  async execute({ user, channel, message }: CommandActionContext, { ARG }: CommandActionParams): Promise<void> {
    if (!ARG) {
      const categoryListEmbed = embed.help.categoryList(COMMAND_CATEGORIES);
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
      const commandListEmbed = embed.help.commandList(category);
      await channel.sendEmbed(commandListEmbed);
      return;
    }

    const command = COMMANDS.find(cmd => cmd.info.name.toLowerCase() === arg);
    if (command) {
      const commandEmbed = embed.help.commandDetails(command.info);
      await channel.sendEmbed(commandEmbed);
      return;
    }

    const keyword = KEYWORDS[arg.toUpperCase()];
    if (keyword && keyword.permission <= user.permission) {
      const keywordEmbed = embed.help.keywordDetails(keyword);
      await channel.sendEmbed(keywordEmbed);
      return;
    }

    await channel.send(`Sorry! I don't think anything is referred to as \`${arg}\``);
  }

}

export const HELP_COMMAND: Command = {
  info,
  createAction(services) {
    return new HelpAction(services);
  }
}