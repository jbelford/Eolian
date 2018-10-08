import { PERMISSION } from "../../common/constants";
import { Embed } from "../../common/embed";
import { CommandAction, COMMAND_CATEGORIES, GeneralCategory } from "../command";
import { KEYWORDS } from "../keywords";

export const HelpCommand: Command = {
  name: 'help',
  details: 'Shows list of all available categories, commands, keywords, and their details',
  permission: PERMISSION.USER,
  category: GeneralCategory,
  keywords: [KEYWORDS.ARG],
  usage: ['', '{1}', '{General}', '{poll}', '{spotify}', '{keywords}'],
  createAction: (params: CommandParams) => new HelpAction(params)
};

/**
 * Sends a help message for commands and categories based on user arguments.
 */
class HelpAction extends CommandAction {

  public async execute({ message }: CommandActionParams): Promise<void> {
    const categoryListEmbed = Embed.Help.categoryList(COMMAND_CATEGORIES);
    await message.sendEmbed(categoryListEmbed);
  }

}