import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { QUEUE_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { applyRangeToList } from 'common/util';
import { createQueueEmbed } from 'embed';
import { MessageButtonOnClickHandler } from 'eolian/@types';
import { Track } from 'music/@types';

async function executeClearQueue(context: CommandContext, options: CommandOptions): Promise<void> {
  const cleared = await context.queue.clear();
  if (cleared) {
    await context.channel.send('💨 I have cleared the queue!');
  } else {
    await context.channel.send('❓ The queue is already empty!');
  }
}

async function sendQueueEmbed(tracks: Track[], context: CommandContext) {
  const embed = createQueueEmbed(tracks.slice(0, 15), tracks.length);
  embed.buttons = [{ emoji: '🔀', onClick: createShuffleButtonHandler(context) }];
  await context.channel.sendEmbed(embed);
}

function createShuffleButtonHandler(context: CommandContext) : MessageButtonOnClickHandler {
  return async (message, user) => {
    message.delete();
    await context.queue.shuffle();
    await sendQueueEmbed(await context.queue.get(), context);
    return true;
  };
}

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  if (options.CLEAR) {
    return executeClearQueue(context, options);
  }

  let tracks = await context.queue.get();

  if (tracks.length === 0) {
    await context.channel.send('🕳 The queue is empty!');
    return;
  }

  if (options.SHUFFLE) {
    await context.queue.shuffle();
    await context.channel.send('🔀 I have shuffled the queue!');
    return;
  }

  if (options.TOP) {
    tracks = applyRangeToList(options.TOP, tracks);
  } else if (options.BOTTOM) {
    tracks = applyRangeToList(options.BOTTOM, tracks, true);
  }

  if (tracks.length === 0) {
    await context.channel.send('🕳 The provided range is empty!');
    return;
  }

  await sendQueueEmbed(tracks, context);
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
