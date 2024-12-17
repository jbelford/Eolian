import { PATTERNS } from '@eolian/command-options';
import { CommandOptions } from '@eolian/command-options/@types';
import { Closable } from '@eolian/common/@types';
import { NUMBER_TO_EMOJI, EMOJI_TO_NUMBER, UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { logger } from '@eolian/common/logger';
import { createPollQuestionEmbed, createPollResultsEmbed } from '@eolian/embed';
import { PollOption } from '@eolian/embed/@types';
import {
  ContextMessage,
  ContextSendable,
  ContextUser,
  MessageButtonOnClickHandler,
} from '@eolian/framework/@types';
import { CommandContext, Command } from '../@types';
import { GENERAL_CATEGORY } from '../category';

class PollMessage implements Closable {
  private options: PollOption[];
  private userSelections = new Map<string, PollOption>();

  private pollMessage: ContextMessage | undefined;

  constructor(
    private readonly sendable: ContextSendable,
    private readonly user: ContextUser,
    private readonly question: string,
    options: string[],
  ) {
    this.options = options.map((text, i) => ({ text, emoji: NUMBER_TO_EMOJI[i + 1], count: 0 }));
  }

  async close(): Promise<void> {
    if (this.pollMessage) {
      await this.sendResults();
    }
  }

  async send(): Promise<void> {
    const questionEmbed = createPollQuestionEmbed(
      this.question,
      this.options,
      this.user.name,
      this.user.avatar,
    );
    questionEmbed.buttons = this.options.map(option => ({
      emoji: option.emoji,
      onClick: this.selectionHandler,
    }));
    questionEmbed.buttons.push({ emoji: '🚫', onClick: this.closePollHandler });
    if (this.pollMessage) {
      this.pollMessage.editEmbed(questionEmbed);
    } else {
      this.pollMessage = await this.sendable.sendEmbed(questionEmbed);
    }
  }

  async sendResults(): Promise<void> {
    const resultEmbed = createPollResultsEmbed(
      this.question,
      this.options,
      this.user.name,
      this.user.avatar,
    );
    await Promise.allSettled([
      this.sendable.sendEmbed(resultEmbed, { ephemeral: false }),
      this.pollMessage?.delete() ?? Promise.resolve(),
    ]);
    this.pollMessage = undefined;
  }

  private selectionHandler: MessageButtonOnClickHandler = async (interaction, emoji) => {
    const idx = EMOJI_TO_NUMBER[emoji] - 1;
    const selected = this.options[idx];
    const past = this.userSelections.get(interaction.user.id);
    if (past) {
      if (past.emoji !== selected.emoji) {
        past.count--;
        selected.count++;
      } else {
        return false;
      }
    } else {
      selected.count++;
    }

    this.userSelections.set(interaction.user.id, selected);
    this.pollMessage = interaction.message;
    await this.send();

    return false;
  };

  private closePollHandler: MessageButtonOnClickHandler = async interaction => {
    if (interaction.user.id !== this.user.id) {
      return false;
    }
    await this.sendResults();
    return true;
  };
}

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  if (!options.ARG) {
    throw new EolianUserError(
      'Missing arguments! The format is: `poll / question / option1 / option2 / ... / optionN /`',
    );
  } else if (options.ARG.length < 3) {
    logger.warn(
      `Poll action received args of incorrect length. This should not happen. %s`,
      options.ARG,
    );
    throw new EolianUserError('Incorrect number of arguments. Must provide at least 2 options!');
  } else if (options.ARG.length > 11) {
    throw new EolianUserError('Sorry! I only will permit up to 10 options for the poll.');
  }

  const question = options.ARG[0];
  const pollOptions: string[] = options.ARG.slice(1);

  const poll = new PollMessage(
    context.interaction,
    context.interaction.user,
    question,
    pollOptions,
  );

  context.server!.addDisposable(poll);

  await poll.send();
}

export const POLL_COMMAND: Command = {
  name: 'poll',
  category: GENERAL_CATEGORY,
  details: 'Create a poll in the channel. Up to 10 options are allowed.',
  permission: UserPermission.User,
  patterns: [PATTERNS.ARG],
  usage: [
    {
      title: `Create a simple poll`,
      example: [PATTERNS.ARG.ex('What is your favorite color?', 'Red', 'Green', 'Blue')],
    },
  ],
  args: {
    base: true,
    groups: [
      {
        required: true,
        options: [
          {
            name: 'question',
            details: 'The poll question',
          },
        ],
      },
    ].concat(
      Array(10)
        .fill(0)
        .map((_, i) => ({
          required: false,
          options: [
            {
              name: `option_${i + 1}`,
              details: 'Poll option',
            },
          ],
        })),
    ),
  },
  execute,
};
