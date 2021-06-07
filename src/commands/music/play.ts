import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { MUSIC_CATEGORY } from 'commands/category';
import { KEYWORDS, PATTERNS } from 'commands/keywords';
import { createSelectedMessage } from 'commands/queue/add';
import { PERMISSION } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { getSourceResolver } from 'resolvers';


async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  const userVoice = context.user.getVoice();
  if (!userVoice) {
    throw new EolianUserError('You need to be in a voice channel!');
  } else if (!userVoice.joinable) {
    throw new EolianUserError('I do not have permission to join your voice channel!');
  }

  let added = false;
  if (options.SEARCH || options.URL) {
    const resource = await getSourceResolver(context, options).resolve();
    if (resource) {
      const msg = createSelectedMessage(resource.name, resource.authors, resource.identifier);
      await context.channel.send(`✨ ${msg} to be played immediately!`);

      const { tracks } = await resource.fetcher.fetch();
      if (tracks.length > 0) {
        await context.server!.queue.add(tracks, true);
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
    reactionChain = reactionChain.then(() => context.message.react('👋'));
    await userVoice.join();
    voice = context.client.getVoice();
  }

  if (voice) {
    if (!voice.player.isStreaming) {
      context.server!.display.player.setChannel(context.channel);
      reactionChain = reactionChain.then(() => context.message.react('🎵'));
      await voice.player.play();
    } else if (added) {
      reactionChain = reactionChain.then(() => context.message.react('👌'));
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
  keywords: [KEYWORDS.SOUNDCLOUD, KEYWORDS.SPOTIFY, KEYWORDS.YOUTUBE],
  patterns: [PATTERNS.SEARCH, PATTERNS.URL],
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
      example: [PATTERNS.SEARCH.ex('what is love')]
    }
  ],
  execute
};