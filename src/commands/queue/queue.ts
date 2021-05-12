import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { QUEUE_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { getRangeOption } from 'common/util';
import { createQueueEmbed } from 'embed';
import { MessageButtonOnClickHandler } from 'eolian/@types';
import { Track } from 'music/@types';

async function executeClearQueue(context: CommandContext, options: CommandOptions): Promise<void> {
  const cleared = await context.server!.queue.clear();
  if (cleared) {
    await context.channel.send('💨 I have cleared the queue!');
  } else {
    await context.channel.send('❓ The queue is already empty!');
  }
}

async function sendQueueEmbed(tracks: Track[], start: number, total: number, context: CommandContext) {
  const embed = createQueueEmbed(tracks.slice(0, 15), start, total);
  embed.buttons = [{ emoji: '🔀', onClick: createShuffleButtonHandler(context) }];
  await context.channel.sendEmbed(embed);
}

function createShuffleButtonHandler(context: CommandContext) : MessageButtonOnClickHandler {
  return async (message, user) => {
    message.delete();
    await context.server!.queue.shuffle();
    const tracks = await context.server!.queue.get();
    await sendQueueEmbed(tracks, 0, tracks.length, context);
    return true;
  };
}

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  if (options.CLEAR) {
    return executeClearQueue(context, options);
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
  let range = getRangeOption(options, total);
  if (range) {
    tracks = tracks.slice(range.start, range.stop);
  }

  if (tracks.length === 0) {
    await context.channel.send('🕳 The provided range is empty!');
    return;
  }

  await sendQueueEmbed(tracks, range ? range.start : 0, total, context);
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

