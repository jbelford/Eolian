import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { KEYWORDS } from '@eolian/command-options';
import { CommandOptions } from '@eolian/command-options/@types';
import { CommandContext, Command } from '../@types';
import { MUSIC_CATEGORY } from '../category';

async function executeNightcore(context: CommandContext, options: CommandOptions): Promise<void> {
  const info = 'Settings will take effect on the next track!';

  if (options.ENABLE) {
    if (context.server!.player.nightcore) {
      throw new EolianUserError('Nightcore is already enabled!');
    }

    context.server!.player.setNightcore(true);

    let msg = `🌕 Nightcore mode enabled!`;
    if (context.server!.player.isStreaming) {
      msg += ` ${info}`;
    }
    await context.interaction.send(msg, { ephemeral: false });
    return;
  }

  if (options.DISABLE) {
    if (!context.server!.player.nightcore) {
      throw new EolianUserError('Nightcore is already disabled!');
    }

    context.server!.player.setNightcore(false);

    let msg = `🌑 Nightcore mode disabled!`;
    if (context.server!.player.isStreaming) {
      msg += ` ${info}`;
    }
    await context.interaction.send(msg, { ephemeral: false });
    return;
  }

  const enabled = context.server!.player.nightcore
    ? '🌕 Nightcore mode is currently enabled!'
    : '🌑 Nightcore mode is currently disabled!';
  await context.interaction.send(enabled);
}

export const NIGHTCORE_COMMAND: Command = {
  name: 'nightcore',
  shortName: 'nc',
  details: `Enable or disable nightcore mode.`,
  category: MUSIC_CATEGORY,
  permission: UserPermission.DJ,
  keywords: [KEYWORDS.ENABLE, KEYWORDS.DISABLE],
  usage: [
    {
      title: 'See current nightcore status',
      example: '',
    },
    {
      title: 'Enable nightcore',
      example: [KEYWORDS.ENABLE],
    },
    {
      title: 'Disable nightcore',
      example: [KEYWORDS.DISABLE],
    },
  ],
  execute: executeNightcore,
};
