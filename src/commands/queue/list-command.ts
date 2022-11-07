import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { getRangeOption, KEYWORDS, PATTERNS } from '@eolian/command-options';
import { CommandOptions } from '@eolian/command-options/@types';
import { CommandContext, Command } from '../@types';
import { QUEUE_CATEGORY } from '../category';

async function executeClearQueue(context: CommandContext): Promise<void> {
  if (context.interaction.user.permission < UserPermission.DJ) {
    throw new EolianUserError('You do not have permission to clear the queue!');
  }
  const cleared = await context.server!.queue.clear();
  if (cleared) {
    await context.interaction.send('💨 I have cleared the queue!', { ephemeral: false });
  } else {
    await context.interaction.send('❓ The queue is already empty!');
  }
}

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  if (options.CLEAR) {
    return executeClearQueue(context);
  }

  const size = await context.server!.queue.size(true);
  if (size === 0) {
    await context.interaction.send('🕳 The queue is empty!');
    return;
  }

  if (options.SHUFFLE) {
    if (context.interaction.user.permission < UserPermission.DJ) {
      throw new EolianUserError('You do not have permission to shuffle the queue!');
    }
    await context.server!.queue.shuffle();
    await context.interaction.send('🔀 I have shuffled the queue!', { ephemeral: false });
    return;
  }

  const range = getRangeOption(options, size) ?? { start: 0, stop: 15 };

  const [tracks, loop] = await context.server!.queue.get(range.start, range.stop - range.start);
  if (tracks.length + loop.length === 0) {
    await context.interaction.send('🕳 The provided range is empty!');
    return;
  }

  context.server!.display.queue.setChannel(context.interaction.channel, context.interaction);
  await context.server!.display.queue.send(tracks, loop, range ? range.start : 0, size);
}

export const LIST_COMMAND: Command = {
  name: 'list',
  shortName: 'q',
  details: 'Show or clear the queue.',
  category: QUEUE_CATEGORY,
  permission: UserPermission.DJLimited,
  keywords: [KEYWORDS.CLEAR, KEYWORDS.SHUFFLE],
  patterns: [PATTERNS.TOP, PATTERNS.BOTTOM],
  usage: [
    {
      title: 'Show the queue in this channel',
      example: '',
    },
    {
      title: 'Clear the queue',
      example: [KEYWORDS.CLEAR],
    },
    {
      title: 'Show the top 10 songs in the queue',
      example: [PATTERNS.TOP.ex('10')],
    },
    {
      title: 'Show the last 10 songs in the queue',
      example: [PATTERNS.BOTTOM.ex('10')],
    },
    {
      title: 'Shuffle the queue',
      example: [KEYWORDS.SHUFFLE],
    },
  ],
  execute,
};
