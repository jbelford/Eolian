import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { MUSIC_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { createPlayingEmbed } from 'embed';
import { ContextMessage } from 'eolian/@types';
import { Track } from 'music/@types';


async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  const userVoice = context.user.getVoice();
  if (!userVoice) {
    await context.message.reply('You need to be in a voice channel!');
    return;
  }

  await userVoice.join();
  let reaction = context.message.react('👋');

  const voice = context.client.getVoice();
  if (voice) {
    if (!voice.player.isStreaming) {
      let messageCache: ContextMessage;

      voice.player.on('next', async (track: Track) => {
        if (messageCache) {
          await messageCache.delete();
        }

        const embed = createPlayingEmbed(track);
        messageCache = await context.channel.sendEmbed(embed);
      });

      voice.player.once('done', () => {
        if (messageCache) {
          messageCache.delete();
        }
      });

      await voice.player.play();

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