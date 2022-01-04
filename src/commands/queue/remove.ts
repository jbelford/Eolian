import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { QUEUE_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { getRangeOption, PATTERNS } from 'commands/patterns';
import { UserPermission } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { truthySum } from 'common/util';

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  const sum = truthySum(options.TOP, options.BOTTOM, options.NEXT);
  if (sum === 0) {
    throw new EolianUserError(
      'You must provide TOP, BOTTOM, or NEXT keywords so I know what you wanted to remove!'
    );
  } else if (sum > 1) {
    throw new EolianUserError('You must provide only 1 of TOP, BOTTOM, or NEXT keywords!');
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
  }

  const range = getRangeOption(options, queueLength)!;

  const removed = await context.server!.queue.remove(range.start, range.stop - range.start);
  await context.interaction.send(
    `Removed songs ${range.start + 1} to ${range.stop} from the queue! (${removed} total)`,
    { ephemeral: false }
  );
}

export const REMOVE_COMMAND: Command = {
  name: 'remove',
  details: 'Remove songs from the queue.',
  category: QUEUE_CATEGORY,
  permission: UserPermission.DJ,
  keywords: [KEYWORDS.NEXT],
  patterns: [PATTERNS.TOP, PATTERNS.BOTTOM],
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
