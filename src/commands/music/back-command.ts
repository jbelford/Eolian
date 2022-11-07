import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { CommandContext, Command } from '../@types';
import { MUSIC_CATEGORY } from '../category';

async function executeBack(context: CommandContext): Promise<void> {
  const success = await context.server!.queue.unpop(2);
  if (success) {
    if (context.server!.player.isStreaming) {
      await context.server!.player.skip();
    }
    if (context.interaction.reactable) {
      await context.interaction.react('⏪');
    } else {
      await context.interaction.send('⏪', { ephemeral: false });
    }
  } else {
    throw new EolianUserError('There are no previous songs!');
  }
}

export const BACK_COMMAND: Command = {
  name: 'back',
  details: 'Go back a song.',
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
  execute: executeBack,
};
