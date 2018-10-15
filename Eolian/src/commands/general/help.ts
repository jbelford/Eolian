import { CommandAction, COMMAND_CATEGORIES, GeneralCategory } from "commands/command";
import { COMMANDS } from "commands/index";
import { KEYWORDS } from "commands/keywords";
import { PERMISSION } from "common/constants";
import { Embed } from "common/embed";

/**
 * Sends a help message for commands and categories based on user arguments.
 */
class HelpAction extends CommandAction {

  public async execute({ user, channel, message }: CommandActionContext, { ARG }: CommandActionParams): Promise<any> {
    if (!ARG) {
      const categoryListEmbed = Embed.Help.categoryList(COMMAND_CATEGORIES);
      return await channel.sendEmbed(categoryListEmbed);
    }

    const arg = ARG[0].toLowerCase();

    let idx = parseInt(arg);
    if (!isNaN(idx)) {
      if (idx < 1 || idx > COMMAND_CATEGORIES.length) {
        return await message.reply('No category at that index! Please try again.');
      }
      idx--;
    }

    const category = !isNaN(idx) && idx >= 0 && idx < COMMAND_CATEGORIES.length
      ? COMMAND_CATEGORIES[idx] : COMMAND_CATEGORIES.find(category => category.name.toLowerCase() === arg);
    if (category) {
      const commandListEmbed = Embed.Help.commandList(category);
      return await channel.sendEmbed(commandListEmbed);
    }

    const command = COMMANDS.find(cmd => cmd.name.toLowerCase() === arg);
    if (command) {
      const commandEmbed = Embed.Help.commandDetails(command);
      return await channel.sendEmbed(commandEmbed);
    }

    const keyword = KEYWORDS[arg.toUpperCase()];
    if (keyword && (<Keyword>keyword).permission <= user.permission) {
      const keywordEmbed = Embed.Help.keywordDetails(keyword);
      return await channel.sendEmbed(keywordEmbed);
    }

    await channel.send(`Sorry! I don't think anything is referred to as \`${arg}\``);
  }

}

export const HelpCommand: Command = {
  name: 'help',
  details: 'Shows list of all available categories, commands, keywords, and their details',
  permission: PERMISSION.USER,
  category: GeneralCategory,
  keywords: [KEYWORDS.ARG],
  usage: ['', '/General/', '/poll/', '/spotify/', '/arg/', '/ARG/  # Everything is case insensitive',],
  action: HelpAction
};