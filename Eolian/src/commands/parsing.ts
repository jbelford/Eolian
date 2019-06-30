import { KEYWORDS } from "commands/keywords";
import { EolianBotError } from "common/errors";
import environment from "environments/env";

export const KeywordParsingStrategy: CommandParsingStrategy = {

  messageInvokesBot(message: string): boolean {
    return message.trim().charAt(0) === environment.cmdToken;
  },

  parseParams(message: string, permission: PERMISSION): [CommandActionParams, string] {
    let text = this.messageInvokesBot(message) ? message.substr(1) : message;

    const params: CommandActionParams = {};
    // Extract complex keywords
    (Object.values(KEYWORDS) as Keyword[])
      .sort((a, b) => b.priority - a.priority)
      .filter(keyword => keyword.permission <= permission)
      .forEach(keyword => {
        const result = keyword.matchText(text);
        if (!result.matches) return;

        params[keyword.name] = result.args;
        text = result.newText;
      });

    return [params, text];
  },

  parseCommand(message: string, permission: PERMISSION, commands: CommandAction[]): [CommandAction, EolianBotError] {
    const textSplit = message.toLowerCase().split(/\s+/g);
    const matchedCommands = commands
      .filter(cmd => cmd.info.permission <= permission)
      .filter(cmd => textSplit.some(word => word === cmd.info.name));

    if (matchedCommands.length === 0) {
      return [null, new EolianBotError('No command was specified or you do not have permission to use them.')];
    } else if (matchedCommands.length > 1) {
      let previewed = matchedCommands.map(cmd => `'${cmd.info.name}'`).slice(0, 3).join(',');
      if (matchedCommands.length > 3) previewed += ', ...';
      return [null, new EolianBotError('More than one command was specified: ' + previewed)];
    }

    const action = matchedCommands[0];
    return [action, null];
  }

}
