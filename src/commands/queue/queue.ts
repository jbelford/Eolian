import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { QUEUE_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { getRangeOption } from 'common/util';


async function executeClearQueue(context: CommandContext): Promise<void> {
  const cleared = await context.server!.queue.clear();
  if (cleared) {
    await context.channel.send('💨 I have cleared the queue!');
  } else {
    await context.channel.send('❓ The queue is already empty!');
  }
}

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  if (options.CLEAR) {
    return executeClearQueue(context);
  }

  let tracks = await context.server!.queue.get();

  if (tracks.length === 0) {
    await context.channel.send('🕳 The queue is empty!');
    return;
  }

  if (options.SHUFFLE) {
    await context.server!.queue.shuffle();
    await context.channel.send('🔀 I have shuffled the queue!');
    return;
  }

  const total = tracks.length;
  const range = getRangeOption(options, total);
  if (range) {
    tracks = tracks.slice(range.start, range.stop);
  }

  if (tracks.length === 0) {
    await context.channel.send('🕳 The provided range is empty!');
    return;
  }

  context.server!.display.queue.setChannel(context.channel);
  await context.server!.display.queue.send(tracks, range ? range.start : 0, total);
}

export const QUEUE_COMMAND: Command = {
  name: 'queue',
  details: 'Show or clear the queue',
  category: QUEUE_CATEGORY,
  permission: PERMISSION.USER,
  keywords: [
    KEYWORDS.TOP, KEYWORDS.BOTTOM, KEYWORDS.CLEAR, KEYWORDS.SHUFFLE
  ],
  usage: [
    '', 'clear', 'top 10', 'bottom 10', 'shuffle'
  ],
  execute
};

