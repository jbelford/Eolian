import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { MUSIC_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { EolianUserError } from 'common/errors';

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
    await context.channel.send(msg);
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
    await context.channel.send(msg);
    return;
  }

  const enabled = context.server!.player.nightcore
    ? '🌕 Nightcore mode is currently enabled!'
    : '🌑 Nightcore mode is currently disabled!';
  await context.channel.send(enabled);
}

export const NIGHTCORE_COMMAND: Command = {
  name: 'nightcore',
  details: `Enable or disable nightcore mode`,
  category: MUSIC_CATEGORY,
  permission: PERMISSION.USER,
  keywords: [KEYWORDS.ENABLE, KEYWORDS.DISABLE],
  usage: [
    {
      title: 'See current nightcore status',
      example: ''
    },
    {
      title: 'Enable nightcore',
      example: [KEYWORDS.ENABLE]
    },
    {
      title: 'Disable nightcore',
      example: [KEYWORDS.DISABLE]
    }
  ],
  execute: executeNightcore
};