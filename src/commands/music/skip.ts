import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { MUSIC_CATEGORY } from 'commands/category';
import { PERMISSION } from 'common/constants';

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  const voice = context.client.voice;
  if (voice) {
    await voice.player.skip();
  }
}

export const SKIP_COMMAND: Command = {
  name: 'skip',
  details: 'Skip current song',
  category: MUSIC_CATEGORY,
  permission: PERMISSION.USER,
  usage: [''],
  execute
};