import { NOT_PLAYING, UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { CommandContext, Command } from '../@types';
import { MUSIC_CATEGORY } from '../category';

async function execute(context: CommandContext): Promise<void> {
  if (context.server!.player.isStreaming) {
    context.server!.player.stop();
    if (context.interaction.reactable) {
      await context.interaction.react('😢');
    } else {
      await context.interaction.send('⏹️', { ephemeral: false });
    }
  } else {
    throw new EolianUserError(NOT_PLAYING);
  }
}

export const STOP_COMMAND: Command = {
  name: 'stop',
  details: 'Stop playing music.',
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
  execute,
};
