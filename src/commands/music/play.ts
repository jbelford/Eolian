import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { MUSIC_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { getEnumName, PERMISSION, SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { IdentifierType } from 'data/@types';
import { getSourceFetcher, getSourceResolver } from 'resolvers';


async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  const userVoice = context.user.getVoice();
  if (!userVoice) {
    throw new EolianUserError('You need to be in a voice channel!');
  }

  let added = false;
  if (options.SEARCH || options.URL) {
    const resource = await getSourceResolver(context, options).resolve();
    if (resource) {
      const authors = resource.authors.join(',');
      const typeName = getEnumName(IdentifierType, resource.identifier.type);
      const sourceName = getEnumName(SOURCE, resource.identifier.src);
      await context.channel.send(`📍 Selected **${resource.name}** by **${authors}**\n(**${typeName}** from **${sourceName}**)`);

      if (!resource.tracks) {
        const fetchResult = await getSourceFetcher(resource.identifier, options, context.channel).fetch();
        resource.tracks = fetchResult.tracks;
      }

      if (resource.tracks.length > 0) {
        await context.server!.queue.add(resource.tracks, true);
        added = true;
      }
    }
  }

  const next = await context.server!.queue.peek();
  if (!next) {
    throw new EolianUserError('There are no songs in the queue!');
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
      context.server!.display.player.setChannel(context.channel);
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
  details: `Join the current channel. Starts playing first song in the queue if not already.
You may optionally provide a SEARCH or URL pattern to play a song right away.`,
  category: MUSIC_CATEGORY,
  permission: PERMISSION.USER,
  keywords: [
    KEYWORDS.SEARCH, KEYWORDS.SOUNDCLOUD, KEYWORDS.SPOTIFY, KEYWORDS.YOUTUBE, KEYWORDS.URL
  ],
  usage: [
    {
      title: 'Join voice channel and start playing (if not already)',
      example: ''
    },
    {
      title: 'Start playing song from URL',
      example: 'https://www.youtube.com/watch?v=HEXWRTEbj1I'
    },
    {
      title: 'Start playing song from SEARCH',
      example: '(what is love)'
    }
  ],
  execute
};