import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { QUEUE_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { EolianUserError } from 'common/errors';

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  if (options.ENABLE) {
    if (context.server!.queue.loop) {
      throw new EolianUserError('Loop mode is already enabled!');
    }

    await context.server!.queue.setLoopMode(true);

    await context.interaction.send('🔁 Loop mode enabled!');
    return;
  }

  if (options.DISABLE) {
    if (!context.server!.queue.loop) {
      throw new EolianUserError('Loop mode is already disabled!');
    }

    await context.server!.queue.setLoopMode(false);

    await context.interaction.send('🔁 Loop mode disabled!');
    return;
  }

  await context.interaction.send(`🔁 Loop mode is currently ${context.server!.queue.loop ? 'enabled' : 'disabled'}!`);
}

export const LOOP_COMMAND: Command = {
  name: 'loop',
  details: 'Enable or disable loop mode.\nLoop mode adds played tracks back to the end of the queue.',
  category: QUEUE_CATEGORY,
  permission: PERMISSION.USER,
  keywords: [KEYWORDS.ENABLE, KEYWORDS.DISABLE],
  new: true,
  usage: [
    {
      title: 'See current loop mode status',
      example: ''
    },
    {
      title: 'Enable loop mode',
      example: [KEYWORDS.ENABLE]
    },
    {
      title: 'Disable loop mode',
      example: [KEYWORDS.DISABLE]
    }
  ],
  execute
};
