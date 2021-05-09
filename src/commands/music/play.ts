import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { MUSIC_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';


async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  const voice = context.user.voice;
  if (voice) {
    await voice.join();

    const currentVoice = context.client.voice;
    if (currentVoice) {
      currentVoice.player.play();
    }
  }
}

export const PLAY_COMMAND: Command = {
  name: 'play',
  details: 'Start playing music',
  category: MUSIC_CATEGORY,
  permission: PERMISSION.USER,
  keywords: [
    KEYWORDS.QUERY, KEYWORDS.SOUNDCLOUD, KEYWORDS.SPOTIFY, KEYWORDS.YOUTUBE, KEYWORDS.URL
  ],
  usage: [
    '',
    'https://www.youtube.com/watch?v=HEXWRTEbj1I',
    '(what is love)'
  ],
  execute
};