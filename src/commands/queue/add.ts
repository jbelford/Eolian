import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { QUEUE_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { getEnumName, PERMISSION, SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { applyRangeToList, shuffleList, truthySum } from 'common/util';
import { Identifier, IdentifierType } from 'data/@types';
import { getSourceFetcher, getSourceResolver } from 'resolvers';


async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  const sum = truthySum(options.QUERY, options.URL, options.IDENTIFIER);
  if (sum === 0 && !options.MY) {
    throw new EolianUserError('You must provide me a query, url, or identifier. Please try again.');
  } else if (sum > 1) {
    throw new EolianUserError('You must only include 1 query, url, or identifier. Please try again.');
  }

  let identifier: Identifier | null = null;
  if (options.IDENTIFIER) {
    const user = await context.user.get();
    if (!user.identifiers || !user.identifiers[options.IDENTIFIER]) {
      throw new EolianUserError(`That identifier is unrecognized!`);
    }
    identifier = user.identifiers[options.IDENTIFIER];
    await context.channel.send(`🔎 Resolved identifier ${identifier.url}`
      + `\n(**${getEnumName(IdentifierType, identifier.type)}** from **${getEnumName(SOURCE, identifier.src)}**)`);
  } else {
    const resource = await getSourceResolver(context, options).resolve();
    if (resource) {
      await context.channel.send(`📍 Selected **${resource.name}** by **${resource.authors.join(',')}**`
        + `\n(**${getEnumName(IdentifierType, resource.identifier.type)}**`
        + ` from **${getEnumName(SOURCE, resource.identifier.src)}**)`);
      identifier = resource.identifier;
    }
  }

  if (identifier) {
    let tracks = await getSourceFetcher(identifier, options, context.channel).fetch();
    if (tracks.length > 0) {
      if (options.TOP) {
        tracks = applyRangeToList(options.TOP, tracks);
      } else if (options.BOTTOM) {
        tracks = applyRangeToList(options.BOTTOM, tracks, true);
      }

      if (options.SHUFFLE) {
        shuffleList(tracks);
      }

      await context.queue!.add(tracks, options.NEXT);

      const bodyText = tracks.length > 1 ? `Successfully added ${tracks.length} songs`
        : `Successfully added **${tracks[0].title}**`;
      const endText = options.NEXT ? 'to be played next!' : 'to the queue!';
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
    KEYWORDS.NEXT, KEYWORDS.SHUFFLE, KEYWORDS.FAVORITES, KEYWORDS.TRACKS, KEYWORDS.TOP, KEYWORDS.BOTTOM,
    KEYWORDS.URL, KEYWORDS.QUERY, KEYWORDS.IDENTIFIER,
  ],
  usage: [
    `(what is love) next`,
    'soundcloud favorites shuffled',
    'https://www.youtube.com/watch?v=HEXWRTEbj1I',
    `playlist [retro]`,
    `my playlist (cool playlist)`,
    `spotify playlist (awesome music playlist) shuffle next`,
    `artist (deadmau5) top 10`,
    `tracks`,
    `album (the life of pablo)`
  ],
  execute
};
