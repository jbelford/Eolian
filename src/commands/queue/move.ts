import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { QUEUE_CATEGORY } from 'commands/category';
import { getRangeOption, KEYWORDS, PATTERNS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { EolianUserError } from 'common/errors';

function sanitizeNum(num: number, size: number): number {
  if (!Number.isInteger(num)) {
    throw new EolianUserError('You must provide whole numbers!');
  }
  if (num < 1 || num > size) {
    throw new EolianUserError('You must provide numbers within the queue!');
  }
  return num - 1;
}

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  if (!options.NUMBER && !options.NEXT) {
    throw new EolianUserError('You must provide NEXT keyword or NUMBER position in the queue!');
  }

  const queueLength = await context.server!.queue.size();
  if (queueLength === 0) {
    throw new EolianUserError('Queue is empty!');
  }

  const range = getRangeOption(options, queueLength)!;

  let targetIndex: number;
  if (options.NEXT) {
    targetIndex = 0;
  } else {
    if (range) {
      targetIndex = sanitizeNum(options.NUMBER![0], queueLength);
    } else {
      if (options.NUMBER!.length < 2) {
        throw new EolianUserError('You must specify NUMBER position to move to!');
      }
      targetIndex = sanitizeNum(options.NUMBER![1], queueLength);
    }
  }

  if (range) {
    await context.server!.queue.move(targetIndex, range.start, range.stop - range.start);
  } else {
    if (!options.NUMBER) {
      throw new EolianUserError('You must provide NUMBER for song to move!');
    }
    const from = sanitizeNum(options.NUMBER[0], queueLength);
    await context.server!.queue.move(targetIndex, from, 1);
  }
}

export const MOVE_COMMAND: Command = {
  name: 'move',
  details: 'Move songs in the queue',
  category: QUEUE_CATEGORY,
  permission: PERMISSION.USER,
  keywords: [KEYWORDS.NEXT],
  patterns: [PATTERNS.NUMBER, PATTERNS.TOP, PATTERNS.BOTTOM],
  usage: [
    {
      title: 'Move 5th song to play next',
      example: [PATTERNS.NUMBER.ex('5'), KEYWORDS.NEXT]
    },
    {
      title: 'Move range of songs to 2nd index',
      example: [PATTERNS.TOP.ex('8:15'), PATTERNS.NUMBER.ex('2')]
    },
    {
      title: 'Move 10th song to 3rd position',
      example: [PATTERNS.NUMBER.ex('10'), PATTERNS.NUMBER.ex('3')]
    }
  ],
  execute
};