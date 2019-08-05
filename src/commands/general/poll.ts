import { GENERAL_CATEGORY } from "commands/category";
import { KEYWORDS } from "commands/keywords";
import { PERMISSION } from 'common/constants';
import { logger } from "common/logger";
import * as embed from "embed";

// Have to use explicit unicode
const emojis = ['\u0031\u20E3', '\u0032\u20E3', '\u0033\u20E3', '\u0034\u20E3', '\u0035\u20E3',
  '\u0036\u20E3', '\u0037\u20E3', '\u0038\u20E3', '\u0039\u20E3', '\u1F51F'];
const close = '🚫';

const info: CommandInfo = {
  name: 'poll',
  category: GENERAL_CATEGORY,
  details: 'Create a poll in the channel. Up to 10 options are allowed.',
  permission: PERMISSION.USER,
  keywords: [KEYWORDS.ARG],
  usage: ['/ What is your favorite color? / Red / Green / Blue /'],
};

class PollAction implements CommandAction {

  constructor(private readonly services: CommandActionServices) {}

  async execute({ message, channel, user }: CommandActionContext, { ARG }: CommandActionParams): Promise<void> {
    if (!ARG) {
      await message.reply('Missing arguments! The format is: `poll / question / option1 / option2 / ... / optionN /`')
      return;
    } else if (ARG.length < 3) {
      logger.warn(`Poll action received args of incorrect length. This should not happen. ${ARG}`);
      await message.reply('Incorrect number of arguments. Must provide at least 2 options!');
      return;
    } else if (ARG.length > 11) {
      await message.reply('Sorry! I only will permit up to 10 options for the poll.');
      return;
    }

    const question = ARG[0];
    const options: PollOption[] = ARG.slice(1).map((text, i) => ({ text, emoji: emojis[i] }));
    const questionEmbed = embed.poll.question(question, options, user.name, user.avatar);

    const closePollHandler = async (message: ContextMessage, reactionUser: ContextUser) => {
      if (reactionUser.id !== user.id) return false;

      const buttons = message.getButtons().filter(button => options.some(option => option.emoji === button.emoji));
      const results: PollOptionResult[] = options.map(option => {
        const button = buttons.find(button => button.emoji === option.emoji);
        return { option: option.text, count: button ? button.count : 0 };
      });

      const resultEmbed = embed.poll.results(question, results, user.name, user.avatar);
      await Promise.all([channel.sendEmbed(resultEmbed), message.delete()]);
      return true;
    };
    questionEmbed.buttons!.push({ emoji: close, onClick: closePollHandler });

    await channel.sendEmbed(questionEmbed);
  }

}

export const POLL_COMMAND: Command = {
  info,
  createAction(services) {
    return new PollAction(services);
  }
};
