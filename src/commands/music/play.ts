import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { MUSIC_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { getEnumName, PERMISSION, SOURCE } from 'common/constants';
import { IdentifierType } from 'data/@types';
import { createPlayingEmbed } from 'embed';
import { ContextMessage } from 'eolian/@types';
import { Track } from 'music/@types';
import { getSourceFetcher, getSourceResolver } from 'resolvers';


async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  const userVoice = context.user.getVoice();
  if (!userVoice) {
    await context.message.reply('You need to be in a voice channel!');
    return;
  }

  let added = false;
  if (options.QUERY || options.URL) {
    const resource = await getSourceResolver(context, options).resolve();
    if (resource) {
      await context.channel.send(`📍 Selected **${resource.name}** by **${resource.authors.join(',')}**`
        + `\n(**${getEnumName(IdentifierType, resource.identifier.type)}**`
        + ` from **${getEnumName(SOURCE, resource.identifier.src)}**)`);

      const tracks = await getSourceFetcher(resource.identifier).fetch();
      if (tracks.length > 0) {
        await context.queue!.add(tracks, true);
        added = true;
      }
    }
  }

  let reactionChain = Promise.resolve();

  let voice = context.client.getVoice();
  if (!voice || voice.channelId !== userVoice.id) {
    await userVoice.join();
    reactionChain = reactionChain.then(() => context.message.react('👋'));
    voice = context.client.getVoice();
  }

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
      reactionChain = reactionChain.then(() => context.message.react('🎵'));
    } else if (added) {
      await voice.player.skip();
    }
  }

  await reactionChain;
}

export const PLAY_COMMAND: Command = {
  name: 'play',
  details: `Start playing music OR join the current channel (if already playing).
You may optionally provide a query OR url to play that song right away.
If query OR url is provided and currently streaming. The current song will be skipped and the requested song will be played.`,
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