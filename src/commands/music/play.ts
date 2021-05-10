import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { MUSIC_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { createPlayingEmbed } from 'embed';
import { ContextMessage } from 'eolian/@types';
import { Track } from 'music/@types';


async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  const voice = context.user.voice;
  if (!voice) {
    await context.message.reply('You need to be in a voice channel!');
    return;
  }

  await voice.join();
  let reaction = context.message.react('👋');

  const currentVoice = context.client.voice;
  if (currentVoice) {
    const player = currentVoice.player;
    if (!player.isStreaming) {
      let messageCache: ContextMessage;

      player.on('next', async (track: Track) => {
        if (messageCache) {
          await messageCache.delete();
        }

        const embed = createPlayingEmbed(track);
        messageCache = await context.channel.sendEmbed(embed);
      });

      player.once('done', () => {
        if (messageCache) {
          messageCache.delete();
        }
      });

      await player.play();

      reaction = reaction.then(() => context.message.react('🎵'));
    }
  }

  await reaction;
}

export const PLAY_COMMAND: Command = {
  name: 'play',
  details: 'Start playing music OR join the current channel (if already playing)',
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