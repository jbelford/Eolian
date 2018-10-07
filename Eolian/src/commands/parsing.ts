import environment from "../environments/env";
import { KEYWORDS } from "./keywords";

export class KeywordParsingStrategy implements CommandParsingStrategy {

  messageInvokesBot(message: string): boolean {
    return message.trim().charAt(0) === environment.cmdToken;
  }

  convertToExecutable(message: string, permission: PERMISSION): [CommandAction<unknown>, EolianBotError] {
    let text = message;
    const keywordArguments = {};
    // Extract complex keywords
    (Object.values(KEYWORDS) as Keyword[])
      // @ts-ignore // Let these be coerced into numbers so that complex are tested first
      .sort((a, b) => b.complex - a.complex)
      .filter(keyword => keyword.permission <= permission)
      .forEach(keyword => {
        const result = keyword.matchText(text);
        if (!result.matches) return;

        keywordArguments[keyword.name] = result.args;
        text = result.newText;
      });


    throw new Error("Method not implemented.");
  }

}