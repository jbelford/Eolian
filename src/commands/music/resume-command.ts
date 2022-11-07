import { NOT_PLAYING, UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { CommandContext, Command } from '../@types';
import { MUSIC_CATEGORY } from '../category';

async function executeResume(context: CommandContext): Promise<void> {
  if (context.server!.player.isStreaming) {
    if (context.server!.player.paused) {
      await context.server!.player.resume();
      if (context.interaction.reactable) {
        await context.interaction.react('▶');
      } else {
        await context.interaction.send('▶️', { ephemeral: false });
      }
    } else {
      throw new EolianUserError('Playback is not paused!');
    }
  } else {
    throw new EolianUserError(NOT_PLAYING);
  }
}

export const RESUME_COMMAND: Command = {
  name: 'resume',
  details: 'Resume the current song.',
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
  execute: executeResume,
};
