import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { MUSIC_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PATTERNS } from 'commands/patterns';
import { UserPermission } from 'common/constants';
import { EolianUserError } from 'common/errors';

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  let volume = context.server!.player.volume;

  if (options.MORE) {
    volume = Math.min(1, volume + 0.1);
  } else if (options.LESS) {
    volume = Math.max(0, volume - 0.1);
  } else if (options.NUMBER) {
    if (options.NUMBER[0] < 0 || options.NUMBER[0] > 100) {
      throw new EolianUserError('Volume must be between 0-100!');
    }
    volume = options.NUMBER[0] / 100;
  }

  if (context.server!.player.volume !== volume) {
    context.server!.player.setVolume(volume);
  }

  if (!context.server!.player.isStreaming) {
    await context.interaction.send(`🔊  **${Math.floor(volume * 100)}%**  🔊`);
  } else if (context.interaction.reactable) {
    await context.interaction.react('🔊');
  } else {
    await context.interaction.send('🔊', { ephemeral: false });
  }
}

export const VOLUME_COMMAND: Command = {
  name: 'volume',
  details: `Get the current volume or set the volume.`,
  category: MUSIC_CATEGORY,
  permission: UserPermission.DJ,
  keywords: [KEYWORDS.MORE, KEYWORDS.LESS],
  patterns: [PATTERNS.NUMBER],
  usage: [
    {
      title: 'Get current volume',
      example: '',
    },
    {
      title: 'Increase the volume',
      example: [KEYWORDS.MORE],
    },
    {
      title: 'Decrease the volume',
      example: [KEYWORDS.LESS],
    },
    {
      title: 'Set the volume to 75%',
      example: '75',
    },
  ],
  execute,
};
