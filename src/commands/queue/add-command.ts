import { SOURCE_DETAILS } from '@eolian/api';
import { UserPermission } from '@eolian/common/constants';
import { environment } from '@eolian/common/env';
import { EolianUserError } from '@eolian/common/errors';
import { truthySum, shuffleList } from '@eolian/common/util';
import { feature } from '@eolian/data';
import { Identifier, ResourceType, FeatureFlag } from '@eolian/data/@types';
import { getRangeOption, KEYWORDS, PATTERNS } from '@eolian/command-options';
import { CommandOptions } from '@eolian/command-options/@types';
import { RESOURCE_TYPE_DETAILS, getSourceFetcher, getSourceResolver } from '@eolian/resolvers';
import { SourceFetcher } from '@eolian/resolvers/@types';
import { CommandContext, Command, MessageCommand } from '../@types';
import { QUEUE_CATEGORY } from '../category';

export function createSelectedMessage(
  name: string,
  authors: string[],
  identifier: Identifier,
): string {
  let text = `Selected **${name}**`;
  if (identifier.type !== ResourceType.Artist) {
    text += ` by **${authors.join(',')}**`;
  }
  const typeName = RESOURCE_TYPE_DETAILS[identifier.type].name;
  const sourceName = SOURCE_DETAILS[identifier.src].name;
  text += ` (**${typeName}** from **${sourceName}**)`;
  return text;
}

async function executeAdd(context: CommandContext, options: CommandOptions): Promise<void> {
  if (!options.POEM) {
    const sum = truthySum(options.SEARCH, options.URL, options.IDENTIFIER);
    if (sum === 0 && !options.MY) {
      throw new EolianUserError(
        'You must provide me a SEARCH, URL or IDENTIFIER pattern or use the MY keyword. See `help add` to learn more.',
      );
    } else if (sum > 1) {
      throw new EolianUserError(
        'You can only include 1 SEARCH, URL, or IDENTIFIER pattern. Please try again. See `help add` to learn more.',
      );
    }
  }

  let fetcher: SourceFetcher | undefined;
  if (options.IDENTIFIER) {
    const user = await context.interaction.user.get();
    if (!user.identifiers || !user.identifiers[options.IDENTIFIER]) {
      throw new EolianUserError(`That identifier is unrecognized!`);
    }
    const identifier = user.identifiers[options.IDENTIFIER];

    const typeName = RESOURCE_TYPE_DETAILS[identifier.type].name;
    const srcName = SOURCE_DETAILS[identifier.src].name;
    await context.interaction.send(
      `🔎 Resolved identifier \`${identifier.url}\` (**${typeName}** from **${srcName}**)`,
      { ephemeral: false },
    );

    fetcher = await getSourceFetcher(identifier, context, options);
  } else {
    await context.interaction.defer(false);
    const resource = await getSourceResolver(context, options).resolve();
    if (resource) {
      const msg =
        '🔎 ' + createSelectedMessage(resource.name, resource.authors, resource.identifier);
      if (resource.selectionMessage) {
        await resource.selectionMessage.edit(msg);
      } else {
        await context.interaction.send(msg);
      }
      fetcher = resource.fetcher;
    }
  }

  if (!fetcher) {
    throw new EolianUserError(`Could not find any tracks to add to the queue! Please try again.`);
  }

  // eslint-disable-next-line prefer-const
  let { tracks, rangeOptimized } = await fetcher.fetch();
  if (!tracks.length) {
    throw new EolianUserError('No tracks at the provided resource! Please try again.');
  }

  if (!rangeOptimized) {
    const range = getRangeOption(options, tracks.length);
    if (range) {
      tracks = tracks.slice(range.start, range.stop);
    }
  }

  if (options.SHUFFLE) {
    shuffleList(tracks);
  }

  const details = await context.server!.details.get();
  const queueSize = await context.server!.queue.size();
  const queueLimit = details.queueLimit ?? environment.config.queueLimit;
  if (queueSize + tracks.length > queueLimit) {
    throw new EolianUserError(
      `Sorry, the queue limit is capped at ${queueLimit}! Remove items from queue and try again`,
    );
  }

  await context.server!.queue.add(tracks, options.NEXT);

  const bodyText =
    tracks.length > 1 ? `Added ${tracks.length} songs` : `Added **${tracks[0].title}**`;
  const endText = options.NEXT ? 'to be played next!' : 'to the queue!';
  await context.interaction.channel.send(`✨ ${bodyText} ${endText}`, { ephemeral: false });
}

export const ADD_COMMAND: Command = {
  name: 'add',
  shortName: 'a',
  details: 'Add songs to the queue.',
  category: QUEUE_CATEGORY,
  permission: UserPermission.DJLimited,
  keywords: [
    KEYWORDS.MY,
    KEYWORDS.SOUNDCLOUD,
    KEYWORDS.SPOTIFY,
    KEYWORDS.YOUTUBE,
    KEYWORDS.POEM,
    KEYWORDS.AI,
    KEYWORDS.PLAYLIST,
    KEYWORDS.ALBUM,
    KEYWORDS.ARTIST,
    KEYWORDS.LIKES,
    KEYWORDS.TRACKS,
    KEYWORDS.NEXT,
    KEYWORDS.SHUFFLE,
    KEYWORDS.FAST,
    KEYWORDS.SHORT,
    KEYWORDS.LONG,
    KEYWORDS.RANDOM,
  ],
  patterns: [PATTERNS.SEARCH, PATTERNS.IDENTIFIER, PATTERNS.URL, PATTERNS.TOP, PATTERNS.BOTTOM],
  usage: [
    {
      title: `Search song and add to top of the queue`,
      example: [PATTERNS.SEARCH.ex('what is love'), KEYWORDS.NEXT],
    },
    {
      title: 'Add song and select first result by default',
      example: [PATTERNS.SEARCH.ex('what is love'), KEYWORDS.FAST],
    },
    {
      title: 'Add song from URL',
      example: [PATTERNS.URL.ex('https://www.youtube.com/watch?v=HEXWRTEbj1I')],
    },
    {
      title: 'Add songs from your saved identifier',
      example: [PATTERNS.IDENTIFIER.ex('retro')],
    },
    {
      title: 'Search for artist and add their top 5 songs',
      example: [KEYWORDS.ARTIST, PATTERNS.SEARCH.ex('deadmau5'), PATTERNS.TOP.ex('5')],
    },
    {
      title: 'Search for album and add songs to queue',
      example: [KEYWORDS.ALBUM, PATTERNS.SEARCH.ex('the life of pablo')],
    },
    {
      title: 'Search for playlist from your linked Spotify account and add songs to top of queue',
      example: [
        KEYWORDS.MY,
        KEYWORDS.SPOTIFY,
        KEYWORDS.PLAYLIST,
        PATTERNS.SEARCH.ex('cool playlist'),
        KEYWORDS.NEXT,
      ],
    },
    {
      title: `Get likes from your linked SoundCloud account, shuffle them, and add to queue`,
      example: [KEYWORDS.MY, KEYWORDS.SOUNDCLOUD, KEYWORDS.LIKES, KEYWORDS.SHUFFLE],
    },
    {
      title: 'Add likes from your Spotify account',
      example: [KEYWORDS.MY, KEYWORDS.SPOTIFY, KEYWORDS.LIKES],
      hide: !feature.enabled(FeatureFlag.SPOTIFY_AUTH),
    },
    {
      title: 'Add your top tracks from Spotify',
      example: [KEYWORDS.MY, KEYWORDS.SPOTIFY, KEYWORDS.TRACKS],
      hide: !feature.enabled(FeatureFlag.SPOTIFY_AUTH),
    },
  ],
  execute: executeAdd,
};

export const ADD_MESSAGE_COMMAND: MessageCommand = {
  name: 'Add to Queue',
  permission: UserPermission.DJLimited,
  patterns: [PATTERNS.SEARCH, PATTERNS.URL],
  execute(context, options) {
    if (!options.URL && !options.SEARCH) {
      throw new EolianUserError('This message must contain something to search or a valid URL');
    }
    if (options.URL) {
      options.SEARCH = undefined;
    }
    return executeAdd(context, options);
  },
};
