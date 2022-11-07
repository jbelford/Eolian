import { NOT_PLAYING, UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { CommandContext, Command } from '../@types';
import { MUSIC_CATEGORY } from '../category';

async function executeShowPlayer(context: CommandContext): Promise<void> {
  if (context.server!.player.isStreaming) {
    context.server!.display.player.setChannel(context.interaction.channel, context.interaction);
    await context.server!.display.player.refresh();
  } else {
    throw new EolianUserError(NOT_PLAYING);
  }
}

export const SHOW_COMMAND: Command = {
  name: 'show',
  details: `Show what's playing. This will move the player and bind it to this channel.`,
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
  execute: executeShowPlayer,
};
