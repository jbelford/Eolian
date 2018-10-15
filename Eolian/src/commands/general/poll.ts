import { CommandAction, GeneralCategory } from "commands/command";
import { KEYWORDS } from "commands/keywords";
import { PERMISSION } from "common/constants";
import { Embed } from "common/embed";
import { logger } from "common/logger";

// Have to use explicit unicode
const emojis = ['\u0031\u20E3', '\u0032\u20E3', '\u0033\u20E3', '\u0034\u20E3', '\u0035\u20E3',
  '\u0036\u20E3', '\u0037\u20E3', '\u0038\u20E3', '\u0039\u20E3', '\u1F51F'];
const close = '🚫';

class PollAction extends CommandAction {

  public async execute({ message, channel, user }: CommandActionContext, { ARG }: CommandActionParams): Promise<void> {
    if (!ARG) {
      return await message.reply('Missing arguments! The format is: `poll / question / option1 / option2 / ... / optionN /`')
    } else if (ARG.length < 3) {
      logger.warn(`Poll action received args of incorrect length. This should not happen. ${ARG}`);
      return await message.reply('Incorrect number of arguments. Must provide at least 2 options!');
    } else if (ARG.length > 11) {
      return await message.reply('Sorry! I only will permit up to 10 options for the poll.');
    }

    const question = ARG[0];
    const options: PollOption[] = ARG.slice(1).map((text, i) => ({ text: text, emoji: emojis[i] }));
    const embed = Embed.Poll.question(question, options, user.name, user.avatar);

    const closePollHandler = async (message: ContextMessage, reactionUser: ContextUser) => {
      if (reactionUser.id !== user.id) return;

      const buttons = message.getButtons().filter(button => options.some(option => option.emoji === button.emoji));
      const results: PollOptionResult[] = options.map(option => {
        const button = buttons.find(button => button.emoji === option.emoji);
        return { option: option.text, count: button ? button.count : 0 };
      });

      const resultEmbed = Embed.Poll.results(question, results, user.name, user.avatar);
      await Promise.all([channel.sendEmbed(resultEmbed), message.delete()]);
      return true;
    };
    embed.buttons.push({ emoji: close, onClick: closePollHandler });

    await channel.sendEmbed(embed);
  }

}

export const PollCommand: Command = {
  name: 'poll',
  category: GeneralCategory,
  details: 'Create a poll in the channel. Up to 10 options are allowed.',
  permission: PERMISSION.USER,
  keywords: [KEYWORDS.ARG],
  usage: ['/ What is your favorite color? / Red / Green / Blue /'],
  action: PollAction
};