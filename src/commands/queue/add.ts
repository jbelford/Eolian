import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { QUEUE_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { getEnumName, PERMISSION, SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { getRangeOption, shuffleList, truthySum } from 'common/util';
import { IdentifierType } from 'data/@types';
import { getSourceFetcher, getSourceResolver } from 'resolvers';
import { SourceFetcher } from 'resolvers/@types';


async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  const sum = truthySum(options.SEARCH, options.URL, options.IDENTIFIER);
  if (sum === 0 && !options.MY) {
    throw new EolianUserError('You must provide me a SEARCH, URL or IDENTIFIER pattern or use the MY keyword. See `help add` to learn more.');
  } else if (sum > 1) {
    throw new EolianUserError('You can only include 1 SEARCH, URL, or IDENTIFIER pattern. Please try again. See `help add` to learn more.');
  }

  let fetcher: SourceFetcher | undefined;
  if (options.IDENTIFIER) {
    const user = await context.user.get();
    if (!user.identifiers || !user.identifiers[options.IDENTIFIER]) {
      throw new EolianUserError(`That identifier is unrecognized!`);
    }
    const identifier = user.identifiers[options.IDENTIFIER];

    const typeName = getEnumName(IdentifierType, identifier.type);
    const srcName = getEnumName(SOURCE, identifier.src);
    await context.channel.send(`🔎 Resolved identifier ${identifier.url}\n(**${typeName}** from **${srcName}**)`);

    fetcher = getSourceFetcher(identifier, options, context.channel);
  } else {
    const resource = await getSourceResolver(context, options).resolve();
    if (resource) {
      const authors = resource.authors.join(',');
      const typeName = getEnumName(IdentifierType, resource.identifier.type);
      const sourceName = getEnumName(SOURCE, resource.identifier.src);
      await context.channel.send(`📍 Selected **${resource.name}** by **${authors}**\n(**${typeName}** from **${sourceName}**)`);
      fetcher = resource.fetcher;
    }
  }

  if (fetcher) {
    // eslint-disable-next-line prefer-const
    let { tracks, rangeOptimized } = await fetcher.fetch();
    if (tracks.length > 0) {
      if (!rangeOptimized) {
        const range = getRangeOption(options, tracks.length);
        if (range) {
          tracks = tracks.slice(range.start, range.stop);
        }
      }

      if (options.SHUFFLE) {
        shuffleList(tracks);
      }

      await context.server!.queue.add(tracks, options.NEXT);

      const bodyText = tracks.length > 1
        ? `Successfully added ${tracks.length} songs`
        : `Successfully added **${tracks[0].title}**`;
      const endText = options.NEXT
        ? 'to be played next!'
        : 'to the queue!';
      await context.channel.send(`✨ ${bodyText} ${endText}`);

      return;
    }
  }

  throw new EolianUserError(`Could not find any tracks to add to the queue! Please try again.`);
}

export const ADD_COMMAND: Command = {
  name: 'add',
  details: 'Add songs to the queue',
  category: QUEUE_CATEGORY,
  permission: PERMISSION.USER,
  keywords: [
    KEYWORDS.MY, KEYWORDS.SOUNDCLOUD, KEYWORDS.SPOTIFY, KEYWORDS.YOUTUBE, KEYWORDS.PLAYLIST, KEYWORDS.ALBUM, KEYWORDS.ARTIST,
    KEYWORDS.LIKES, KEYWORDS.TRACKS, KEYWORDS.NEXT, KEYWORDS.SHUFFLE,
    KEYWORDS.SEARCH, KEYWORDS.IDENTIFIER, KEYWORDS.URL, KEYWORDS.TOP, KEYWORDS.BOTTOM,
  ],
  usage: [
    {
      title: `Search song and add to top of the queue`,
      example: `(what is love) next`
    },
    {
      title: 'Add song from URL',
      example: 'https://www.youtube.com/watch?v=HEXWRTEbj1I'
    },
    {
      title: 'Add songs from your saved identifier',
      example: '[retro]'
    },
    {
      title: 'Search for artist and add their top 5 songs',
      example: 'artist (deadmau5) top 5'
    },
    {
      title: 'Search for album and add songs to queue',
      example: 'album (the life of pablo)'
    },
    {
      title: 'Search for playlist from your linked Spotify account and add songs to top of queue',
      example: `my spotify playlist (cool playlist) next`
    },
    {
      title: `Get likes from your linked SoundCloud account, shuffle them, and add to queue`,
      example: 'my soundcloud likes shuffled'
    },
  ],
  execute
};
