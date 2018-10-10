import { PERMISSION } from "../common/constants";
import { EolianBotError } from "../common/errors";
import environment from "../environments/env";
import { CommandAction } from "./command";
import { COMMANDS } from "./index";
import { KEYWORDS } from "./keywords";

export class KeywordParsingStrategy implements CommandParsingStrategy {

  messageInvokesBot(message: string): boolean {
    return message.trim().charAt(0) === environment.cmdToken;
  }

  convertToExecutable(message: string, permission: PERMISSION): [CommandAction, EolianBotError] {
    let text = this.messageInvokesBot(message) ? message.substr(1) : message;

    const params: CommandParams = {};
    // Extract complex keywords
    (Object.values(KEYWORDS) as Keyword[])
      // @ts-ignore // Let these be coerced into numbers so that complex are tested first
      .sort((a, b) => !!b.complex - !!a.complex)
      .filter(keyword => keyword.permission <= permission)
      .forEach(keyword => {
        const result = keyword.matchText(text);
        if (!result.matches) return;

        params[keyword.name] = result.args;
        text = result.newText;
      });

    // Search for commands after we have removed keyword arguments from the text
    const textSplit = text.toLowerCase().split(/\s+/g);
    const matchedCommands = COMMANDS
      .filter(cmd => cmd.permission <= permission)
      .filter(cmd => textSplit.some(word => word === cmd.name));

    if (matchedCommands.length === 0) {
      return [null, new EolianBotError('No command was specified or you do not have permission to use them.')];
    } else if (matchedCommands.length > 1) {
      let previewed = matchedCommands.map(cmd => `'${cmd.name}'`).slice(0, 3).join(',');
      if (matchedCommands.length > 3) previewed += ', ...';
      return [null, new EolianBotError('More than one command was specified: ' + previewed)];
    }

    const command = matchedCommands[0];
    const action = command.createAction(params);
    return [action, null];
  }

}