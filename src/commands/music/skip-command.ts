import { NOT_PLAYING, UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { CommandContext, Command } from '../@types';
import { MUSIC_CATEGORY } from '../category';
import { MessageProgressUpdater } from '@eolian/framework/message-progress-updater';

async function react(context: CommandContext, emoji: string): Promise<void> {
  if (context.interaction.reactable) {
    await context.interaction.react(emoji);
  } else {
    await context.interaction.send(emoji, { ephemeral: false });
  }
}

async function executeSkip(context: CommandContext): Promise<void> {
  if (context.server!.player.isStreaming) {
    const progress = new MessageProgressUpdater(context.interaction.channel);
    try {
      await Promise.allSettled([react(context, '⏩'), context.server!.player.skip(progress)]);
    } finally {
      await progress.done();
    }
  } else {
    throw new EolianUserError(NOT_PLAYING);
  }
}

export const SKIP_COMMAND: Command = {
  name: 'skip',
  details: 'Skip current song.',
  category: MUSIC_CATEGORY,
  permission: UserPermission.DJ,
  usage: [
    {
      example: '',
    },
  ],
  args: {
    base: true,
    groups: [],
  },
  execute: executeSkip,
};
