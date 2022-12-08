import { KEYWORDS } from '@eolian/command-options';
import { CommandOptions } from '@eolian/command-options/@types';
import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { CommandContext, Command } from '../@types';
import { MUSIC_CATEGORY } from '../category';

async function executeBassboost(context: CommandContext, options: CommandOptions): Promise<void> {
  const info = 'Settings will take effect on the next track!';

  if (options.ENABLE) {
    if (context.server!.player.bass) {
      throw new EolianUserError('Bass Boost is already enabled!');
    }

    context.server!.player.setBassBoost(true);

    let msg = `🌕 Bass Boost mode enabled!`;
    if (context.server!.player.isStreaming) {
      msg += ` ${info}`;
    }
    await context.interaction.send(msg, { ephemeral: false });
    return;
  }

  if (options.DISABLE) {
    if (!context.server!.player.bass) {
      throw new EolianUserError('Bass Boost is already disabled!');
    }

    context.server!.player.setBassBoost(false);

    let msg = `🌑 Bass Boost mode disabled!`;
    if (context.server!.player.isStreaming) {
      msg += ` ${info}`;
    }
    await context.interaction.send(msg, { ephemeral: false });
    return;
  }

  const enabled = context.server!.player.bass
    ? '🌕 Bass Boost mode is currently enabled!'
    : '🌑 Bass Boost mode is currently disabled!';
  await context.interaction.send(enabled);
}

export const BASSBOOST_COMMAND: Command = {
  name: 'bassboost',
  shortName: 'bb',
  details: `Enable or disable bass boosted mode.`,
  category: MUSIC_CATEGORY,
  permission: UserPermission.DJ,
  keywords: [KEYWORDS.ENABLE, KEYWORDS.DISABLE],
  usage: [
    {
      title: 'See current Bass Boost status',
      example: '',
    },
    {
      title: 'Enable Bass Boost',
      example: [KEYWORDS.ENABLE],
    },
    {
      title: 'Disable Bass Boost',
      example: [KEYWORDS.DISABLE],
    },
  ],
  new: true,
  execute: executeBassboost,
};
