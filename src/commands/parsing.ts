import { COMMANDS } from 'commands';
import { KEYWORDS } from "commands/keywords";
import { PERMISSION } from 'common/constants';
import { environment } from "common/env";
import { EolianBotError } from "common/errors";

export class KeywordParsingStrategy implements CommandParsingStrategy {

  messageInvokesBot(message: string): boolean {
    return message.trim().charAt(0) === environment.cmdToken;
  }

  parseParams(message: string, permission: PERMISSION): [CommandActionParams, string] {
    let text = this.messageInvokesBot(message) ? message.substr(1) : message;

    const params: CommandActionParams = {};
    // Extract complex keywords
    (Object.values(KEYWORDS) as Array<Keyword<unknown>>)
      .sort((a, b) => b.priority - a.priority)
      .filter(keyword => keyword.permission <= permission)
      .forEach(keyword => {
        const result = keyword.matchText(text);
        if (!result.matches) return;

        params[keyword.name] = result.args;
        text = result.newText;
      });

    return [params, text];
  }

  parseCommand(message: string, permission: PERMISSION): [Command | null, EolianBotError | null] {
    const textSplit = message.toLowerCase().split(/\s+/g);
    const matchedCommands = COMMANDS
      .filter(cmd => cmd.info.permission <= permission)
      .filter(cmd => textSplit.some(word => word === cmd.info.name));

    if (matchedCommands.length === 0) {
      return [null, new EolianBotError('No command was specified or you do not have permission to use them.')];
    } else if (matchedCommands.length > 1) {
      let previewed = matchedCommands.map(cmd => `'${cmd.info.name}'`).slice(0, 3).join(',');
      if (matchedCommands.length > 3) previewed += ', ...';
      return [null, new EolianBotError('More than one command was specified: ' + previewed)];
    }

    const cmd = matchedCommands[0];
    return [cmd, null];
  }

}
