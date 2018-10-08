import { CommandAction, GeneralCategory } from "../command";
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

  public execute({ message }: CommandActionParams): Promise<void> {
    throw new Error("Method not implemented.");
  }

}