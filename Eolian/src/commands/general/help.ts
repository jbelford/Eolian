import { PERMISSION } from "../../common/constants";
import { Embed } from "../../common/embed";
import { CommandAction, COMMAND_CATEGORIES, GeneralCategory } from "../command";
import { COMMANDS } from "../index";
import { KEYWORDS } from "../keywords";

export const HelpCommand: Command = {
  name: 'help',
  details: 'Shows list of all available categories, commands, keywords, and their details',
  permission: PERMISSION.USER,
  category: GeneralCategory,
  keywords: [KEYWORDS.ARG],
  usage: ['', '{1}', '{General}', '{poll}', '{spotify}', '{arg}', '{ARG}  // Everything is case insensitive',],
  createAction: (params: CommandParams) => new HelpAction(params)
};

/**
 * Sends a help message for commands and categories based on user arguments.
 */
class HelpAction extends CommandAction {

  public async execute({ user, message }: CommandActionParams): Promise<void> {
    if (!this.commandParams.ARG) {
      const categoryListEmbed = Embed.Help.categoryList(COMMAND_CATEGORIES);
      return await message.sendEmbed(categoryListEmbed);
    }
    const arg = this.commandParams.ARG[0].toLowerCase();

    const category = COMMAND_CATEGORIES.find(category => category.name.toLowerCase() === arg);
    if (category) {
      const commandListEmbed = Embed.Help.commandList(category);
      return await message.sendEmbed(commandListEmbed);
    }

    const command = COMMANDS.find(cmd => cmd.name.toLowerCase() === arg);
    if (command) {
      const commandEmbed = Embed.Help.commandDetails(command);
      return await message.sendEmbed(commandEmbed);
    }

    const keyword = KEYWORDS[arg.toUpperCase()];
    if (keyword && (<Keyword>keyword).permission <= user.permission) {
      const keywordEmbed = Embed.Help.keywordDetails(keyword);
      return await message.sendEmbed(keywordEmbed);
    }

    await message.send(`Sorry! I don't think anything is referred to as \`${arg}\``);
  }

}