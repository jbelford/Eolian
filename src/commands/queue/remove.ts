import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { QUEUE_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { convertRangeToAbsolute, truthySum } from 'common/util';

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  const sum = truthySum(options.TOP, options.BOTTOM, options.NEXT);
  if (sum === 0) {
    await context.message.reply('You must provide TOP, BOTTOM, or NEXT keywords so I know what you wanted to remove!');
    return;
  } else if (sum > 1) {
    await context.message.reply('You must provide only 1 of TOP, BOTTOM, or NEXT keywords!');
    return;
  }

  await context.message.react('🌪');

  if (options.NEXT) {
    await context.queue!.pop();
    await context.message.reply('Removed next song from the queue!');
    return;
  }

  const queueLength = (await context.queue!.get()).length;
  const range = options.TOP
    ? convertRangeToAbsolute(options.TOP, queueLength)
    : convertRangeToAbsolute(options.BOTTOM!, queueLength, true);

  const removed = await context.queue!.remove(range);
  await context.message.reply(`Removed songs ${range.start + 1} to ${range.stop} from the queue! (${removed} total)`);
}

export const REMOVE_COMMAND: Command = {
  name: 'remove',
  details: 'Remove songs from the queue',
  category: QUEUE_CATEGORY,
  permission: PERMISSION.USER,
  keywords: [
    KEYWORDS.TOP, KEYWORDS.BOTTOM, KEYWORDS.NEXT
  ],
  usage: [
    `next`,
    `top 10`,
    `bottom 5`
  ],
  execute
};