import { NOT_PLAYING, UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { CommandContext, Command } from '../@types';
import { MUSIC_CATEGORY } from '../category';

async function executeSkip(context: CommandContext): Promise<void> {
  if (context.server!.player.isStreaming) {
    await context.server!.player.skip();
    if (context.interaction.reactable) {
      await context.interaction.react('⏩');
    } else {
      await context.interaction.send('⏩', { ephemeral: false });
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
