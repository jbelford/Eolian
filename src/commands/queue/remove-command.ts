import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { truthySum } from '@eolian/common/util';
import { getRangeOption, KEYWORDS, PATTERNS } from '@eolian/command-options';
import { CommandOptions } from '@eolian/command-options/@types';
import { CommandContext, Command } from '../@types';
import { QUEUE_CATEGORY } from '../category';

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  const sum = truthySum(options.TOP, options.BOTTOM, options.NEXT, options.NUMBER);
  if (sum === 0) {
    throw new EolianUserError(
      'You must provide NUMBER, TOP, BOTTOM, or NEXT keywords so I know what you wanted to remove!',
    );
  } else if (sum > 1) {
    throw new EolianUserError('You must provide only 1 of NUMBER, TOP, BOTTOM, or NEXT keywords!');
  }

  const queueLength = await context.server!.queue.size();
  if (queueLength === 0) {
    throw new EolianUserError('Queue is already empty!');
  }

  await context.interaction.react('🌪');

  if (options.NEXT) {
    await context.server!.queue.pop();
    await context.interaction.send('Removed next song from the queue!', { ephemeral: false });
    return;
  } else if (options.NUMBER) {
    const sorted = options.NUMBER.sort((a, b) => b - a).filter(i => i > 0);
    for (const i of sorted) {
      await context.server!.queue.remove(i - 1, 1);
    }
    const songs = sorted.length > 1 ? 'songs' : 'song';
    await context.interaction.send(`Removed ${sorted.length} ${songs} from the queue!`);
    return;
  }

  const range = getRangeOption(options, queueLength)!;

  const removed = await context.server!.queue.remove(range.start, range.stop - range.start);
  await context.interaction.send(
    `Removed songs ${range.start + 1} to ${range.stop} from the queue! (${removed} total)`,
    { ephemeral: false },
  );
}

export const REMOVE_COMMAND: Command = {
  name: 'remove',
  shortName: 'rm',
  details: 'Remove songs from the queue.',
  category: QUEUE_CATEGORY,
  permission: UserPermission.DJ,
  keywords: [KEYWORDS.NEXT],
  patterns: [PATTERNS.TOP, PATTERNS.BOTTOM, PATTERNS.NUMBER],
  usage: [
    {
      title: 'Remove the next song in the queue',
      example: [KEYWORDS.NEXT],
    },
    {
      title: 'Remove the next 10 songs in the queue',
      example: [PATTERNS.TOP.ex('10')],
    },
    {
      title: 'Remove the last 5 songs in the queue',
      example: [PATTERNS.BOTTOM.ex('5')],
    },
    {
      title: 'Remove songs 2 to 5 (not including 5)',
      example: [PATTERNS.TOP.ex('2:5')],
    },
  ],
  execute,
};
