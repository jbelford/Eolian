import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { QUEUE_CATEGORY } from 'commands/category';
import { getRangeOption, KEYWORDS, PATTERNS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';


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

  const size = await context.server!.queue.size(true);
  if (size === 0) {
    await context.channel.send('🕳 The queue is empty!');
    return;
  }

  if (options.SHUFFLE) {
    await context.server!.queue.shuffle();
    await context.channel.send('🔀 I have shuffled the queue!');
    return;
  }

  const range = getRangeOption(options, size) ?? { start: 0, stop: 15 };

  const [tracks, loop] = await context.server!.queue.get(range.start, range.stop - range.start);
  if (tracks.length + loop.length === 0) {
    await context.channel.send('🕳 The provided range is empty!');
    return;
  }

  context.server!.display.queue.setChannel(context.channel);
  await context.server!.display.queue.send(tracks, loop, range ? range.start : 0, size);
}

export const LIST_COMMAND: Command = {
  name: 'list',
  details: 'Show or clear the queue',
  category: QUEUE_CATEGORY,
  permission: PERMISSION.USER,
  keywords: [KEYWORDS.CLEAR, KEYWORDS.SHUFFLE],
  patterns: [PATTERNS.TOP, PATTERNS.BOTTOM],
  usage: [
    {
      title: 'Show the queue in this channel',
      example: '',
    },
    {
      title: 'Clear the queue',
      example: [KEYWORDS.CLEAR]
    },
    {
      title: 'Show the top 10 songs in the queue',
      example: [PATTERNS.TOP.ex('10')]
    },
    {
      title: 'Show the last 10 songs in the queue',
      example: [PATTERNS.BOTTOM.ex('10')]
    },
    {
      title: 'Shuffle the queue',
      example: [KEYWORDS.SHUFFLE]
    }
  ],
  execute
};

