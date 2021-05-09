import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { MUSIC_CATEGORY } from 'commands/category';
import { PERMISSION } from 'common/constants';

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  const voice = context.client.voice;
  if (voice) {
    voice.disconnect();
  }
}

export const STOP_COMMAND: Command = {
  name: 'stop',
  details: 'Stop playing music',
  category: MUSIC_CATEGORY,
  permission: PERMISSION.USER,
  usage: ['',],
  execute
};