import { NOT_PLAYING, UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { CommandContext, Command } from '../@types';
import { MUSIC_CATEGORY } from '../category';

async function executePause(context: CommandContext): Promise<void> {
  if (context.server!.player.isStreaming) {
    if (context.server!.player.paused) {
      throw new EolianUserError('Playback is already paused!');
    } else {
      await context.server!.player.pause();
      if (context.interaction.reactable) {
        await context.interaction.react('⏸');
      } else {
        await context.interaction.send('⏸️', { ephemeral: false });
      }
    }
  } else {
    throw new EolianUserError(NOT_PLAYING);
  }
}

export const PAUSE_COMMAND: Command = {
  name: 'pause',
  details: 'Pause the current song.',
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
  execute: executePause,
};
