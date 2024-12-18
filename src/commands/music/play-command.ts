import { SOURCE_DETAILS } from '@eolian/api';
import { UserPermission } from '@eolian/common/constants';
import { environment } from '@eolian/common/env';
import { EolianUserError } from '@eolian/common/errors';
import { ResourceType } from '@eolian/data/@types';
import { KEYWORDS, PATTERNS } from '@eolian/command-options';
import { CommandOptions } from '@eolian/command-options/@types';
import { RESOURCE_TYPE_DETAILS, getSourceFetcher, getSourceResolver } from '@eolian/resolvers';
import { SourceFetcher } from '@eolian/resolvers/@types';
import { CommandContext, Command, MessageCommand } from '../@types';
import { MUSIC_CATEGORY } from '../category';
import { createSelectedMessage } from '../queue/add-command';

async function executePlay(context: CommandContext, options: CommandOptions): Promise<void> {
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
    if (identifier.type !== ResourceType.Song) {
      throw new EolianUserError(`Use the \`add\` command instead!`);
    }

    const typeName = RESOURCE_TYPE_DETAILS[identifier.type].name;
    const srcName = SOURCE_DETAILS[identifier.src].name;
    await context.interaction.send(
      `🔎 Resolved identifier \`${identifier.url}\` (**${typeName}** from **${srcName}**)`,
      { ephemeral: false },
    );

    fetcher = await getSourceFetcher(identifier, context, options);
  } else if (options.SEARCH || options.URL || options.POEM) {
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
      const queueLimit = details.queueLimit ?? environment.config.queueLimit;
      if (queueSize + tracks.length > queueLimit) {
        throw new EolianUserError(
          `Sorry, the queue limit is capped at ${queueLimit}! Remove items from queue and try again`,
        );
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
  shortName: 'p',
  shortDetails: `Join the current channel. Starts playing first song in the queue if not already.`,
  details: `Join the current channel. Starts playing first song in the queue if not already.
You may optionally provide a SEARCH, URL, or IDENTIFIER pattern to play a song right away.`,
  category: MUSIC_CATEGORY,
  permission: UserPermission.DJ,
  keywords: [
    KEYWORDS.SOUNDCLOUD,
    KEYWORDS.SPOTIFY,
    KEYWORDS.YOUTUBE,
    KEYWORDS.POEM,
    KEYWORDS.AI,
    KEYWORDS.FAST,
    KEYWORDS.RANDOM,
  ],
  patterns: [PATTERNS.SEARCH, PATTERNS.URL, PATTERNS.IDENTIFIER],
  noDefaultReply: true,
  usage: [
    {
      title: 'Join voice channel and start playing (if not already)',
      example: '',
    },
    {
      title: 'Start playing song from URL',
      example: [PATTERNS.URL.ex('https://www.youtube.com/watch?v=HEXWRTEbj1I')],
    },
    {
      title: 'Start playing song from SEARCH',
      example: [PATTERNS.SEARCH.ex('what is love')],
    },
    {
      title: 'Start playing song from SEARCH and select first result',
      example: [PATTERNS.SEARCH.ex('what is love'), KEYWORDS.FAST],
    },
  ],
  execute: executePlay,
};

export const PLAY_MESSAGE_COMMAND: MessageCommand = {
  name: 'Play',
  permission: UserPermission.DJ,
  patterns: [PATTERNS.SEARCH, PATTERNS.URL],
  noDefaultReply: true,
  execute(context, options) {
    if (!options.URL && !options.SEARCH) {
      throw new EolianUserError('This message must contain something to search or a valid URL');
    }
    if (options.URL) {
      options.SEARCH = undefined;
    }
    return executePlay(context, options);
  },
};
