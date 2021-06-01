import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { GENERAL_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { NUMBER_TO_EMOJI, PERMISSION } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { logger } from 'common/logger';
import { createPollQuestionEmbed, createPollResultsEmbed } from 'embed';
import { PollOption, PollOptionResult } from 'embed/@types';
import { MessageButtonOnClickHandler } from 'eolian/@types';

async function execute({ channel, user, message }: CommandContext, { ARG }: CommandOptions): Promise<void> {
  if (!ARG) {
    throw new EolianUserError('Missing arguments! The format is: `poll / question / option1 / option2 / ... / optionN /`');
  } else if (ARG.length < 3) {
    logger.warn(`Poll action received args of incorrect length. This should not happen. ${ARG}`);
    throw new EolianUserError('Incorrect number of arguments. Must provide at least 2 options!');
  } else if (ARG.length > 11) {
    throw new EolianUserError('Sorry! I only will permit up to 10 options for the poll.');
  }

  const question = ARG[0];
  const options: PollOption[] = ARG.slice(1).map((text, i) => ({ text, emoji: NUMBER_TO_EMOJI[i + 1] }));
  const questionEmbed = createPollQuestionEmbed(question, options, user.name, user.avatar);
  questionEmbed.reactions = options.map(option => option.emoji);

  const closePollHandler: MessageButtonOnClickHandler = async (pollMessage, reactionUser) => {
    if (reactionUser.id !== user.id) return false;

    const buttons = pollMessage.getReactions().filter(reaction => options.some(option => option.emoji === reaction.emoji));
    const results: PollOptionResult[] = options.map(option => {
      const button = buttons.find(button => button.emoji === option.emoji);
      let count = 0;
      if (button && button.count > 0) {
        count = button.count - 1;
      }
      return { option: option.text, count };
    });

    const resultEmbed = createPollResultsEmbed(question, results, user.name, user.avatar);
    await Promise.allSettled([channel.sendEmbed(resultEmbed), pollMessage.delete()]);
    return true;
  };

  questionEmbed.buttons = [{ emoji: '🚫', onClick: closePollHandler }];

  await Promise.allSettled([channel.sendEmbed(questionEmbed), message.delete()]);
}

export const POLL_COMMAND: Command = {
  name: 'poll',
  category: GENERAL_CATEGORY,
  details: 'Create a poll in the channel. Up to 10 options are allowed.',
  permission: PERMISSION.USER,
  keywords: [KEYWORDS.ARG],
  usage: [
    {
      title: `Create a simple poll`,
      example: '/ What is your favorite color? / Red / Green / Blue /'
    }
  ],
  execute
};
