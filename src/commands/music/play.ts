import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { MUSIC_CATEGORY } from 'commands/category';
import { KEYWORDS, PATTERNS } from 'commands/keywords';
import { createSelectedMessage } from 'commands/queue/add';
import { getEnumName, PERMISSION, SOURCE } from 'common/constants';
import { environment } from 'common/env';
import { EolianUserError } from 'common/errors';
import { IdentifierType } from 'data/@types';
import { getSourceFetcher, getSourceResolver } from 'resolvers';
import { SourceFetcher } from 'resolvers/@types';


async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  const userVoice = context.interaction.user.getVoice();
  if (!userVoice) {
    throw new EolianUserError('You need to be in a voice channel!');
  } else if (!userVoice.joinable) {
    throw new EolianUserError('I do not have permission to join your voice channel!');
  }

  let fetcher: SourceFetcher | undefined;
  if (options.IDENTIFIER) {
    const user = await context.interaction.user.get();
    if (!user.identifiers || !user.identifiers[options.IDENTIFIER]) {
      throw new EolianUserError(`That identifier is unrecognized!`);
    }
    const identifier = user.identifiers[options.IDENTIFIER];
    if (identifier.type !== IdentifierType.SONG) {
      throw new EolianUserError(`Use the \`add\` command instead!`);
    }

    const typeName = getEnumName(IdentifierType, identifier.type);
    const srcName = getEnumName(SOURCE, identifier.src);
    await context.interaction.send(`🔎 Resolved identifier \`${identifier.url}\` (**${typeName}** from **${srcName}**)`, { ephemeral: false });

    fetcher = getSourceFetcher(identifier, options, context.interaction);
  } else if (options.SEARCH || options.URL) {
    await context.interaction.defer(false);
    const resource = await getSourceResolver(context, options).resolve();
    if (resource) {
      let msg = createSelectedMessage(resource.name, resource.authors, resource.identifier);
      msg = `✨ ${msg} to be played immediately!`;
      if (resource.selectionMessage) {
        await resource.selectionMessage.edit(msg);
      } else {
        await context.interaction.send(msg);
      }
      fetcher = resource.fetcher;
    }
  }

  let added = false;
  if (fetcher) {
    const { tracks } = await fetcher.fetch();
    if (tracks.length > 0) {
      const details = await context.server!.details.get();
      const queueSize = await context.server!.queue.size();
      const queueLimit = details.queueLimit ?? environment.queueLimit;
      if (queueSize + tracks.length > queueLimit) {
        throw new EolianUserError(`Sorry, the queue limit is capped at ${queueLimit}! Remove items from queue and try again`);
      }
      await context.server!.queue.add(tracks, true);
      added = true;
    }
  }

  const queueLength = await context.server!.queue.size();
  if (!queueLength) {
    throw new EolianUserError('There are no songs in the queue!');
  }

  let reactionChain = Promise.resolve();

  let voice = context.client.getVoice();
  if (!voice || voice.channelId !== userVoice.id) {
    reactionChain = reactionChain.then(() => context.interaction.react('👋'));
    await userVoice.join();
    voice = context.client.getVoice();
  }

  if (voice) {
    if (!context.server!.player.isStreaming) {
      context.server!.display.player.setChannel(context.interaction.channel, context.interaction);
      reactionChain = reactionChain.then(() => context.interaction.react('🎵'));
      await context.server!.player.play();
    } else if (added) {
      reactionChain = reactionChain.then(() => context.interaction.react('👌'));
      await context.server!.player.skip();
    }
  }

  await reactionChain;
}

export const PLAY_COMMAND: Command = {
  name: 'play',
  shortDetails: `Join the current channel. Starts playing first song in the queue if not already.`,
  details: `Join the current channel. Starts playing first song in the queue if not already.
You may optionally provide a SEARCH, URL, or IDENTIFIER pattern to play a song right away.`,
  category: MUSIC_CATEGORY,
  permission: PERMISSION.USER,
  keywords: [KEYWORDS.SOUNDCLOUD, KEYWORDS.SPOTIFY, KEYWORDS.YOUTUBE],
  patterns: [PATTERNS.SEARCH, PATTERNS.URL, PATTERNS.IDENTIFIER],
  noDefaultReply: true,
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