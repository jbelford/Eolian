import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { MUSIC_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  let volume = context.server!.player.volume;

  if (options.MORE) {
    volume = Math.min(1, volume + 0.1);
  } else if (options.LESS) {
    volume = Math.max(0, volume - 0.1);
  } else if (options.ARG) {
    const arg = +options.ARG[0];
    if (isNaN(arg) || arg < 0 || arg > 100) {
      await context.message.reply('Volume must be between 0-100!');
      return;
    }
    volume = arg / 100;
  }

  if (context.server!.player.volume != volume) {
    context.server!.player.setVolume(volume);
  }

  await context.channel.send(`🔊  **${Math.floor(volume * 100)}%**  🔊`);
}

export const VOLUME_COMMAND: Command = {
  name: 'volume',
  details: `Get the current volume or set the volume`,
  category: MUSIC_CATEGORY,
  permission: PERMISSION.USER,
  keywords: [
    KEYWORDS.MORE, KEYWORDS.LESS, KEYWORDS.ARG
  ],
  usage: [
    '',
    'more',
    'less',
    '/75/'
  ],
  execute
};