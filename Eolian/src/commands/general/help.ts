import { CommandAction } from "../commands";
import { KEYWORDS } from "../keywords";

const helpDetails: CommandDetails = {
  name: 'help',
  permission: PERMISSION.USER,
  details: 'Shows list of all available categories, commands, keywords, and their details',
  keywords: [KEYWORDS.ARG],
  usage: ['', '{1}', '{General}', '{poll}', '{spotify}', '{keywords}'],
};

/**
 * This is an object that must be constructed with the following keyword arguments.
 * It will use these arguments to generate a response based on a configured abstraction.
 */
class HelpAction extends CommandAction<{ ARG: string[] }> {

  public execute(): Promise<string> {
    throw new Error("Method not implemented.");
  }

}