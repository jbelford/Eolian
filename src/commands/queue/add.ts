import { BotServices, Command, CommandAction, CommandContext, CommandOptions } from 'commands/@types';
import { QUEUE_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { getEnumName, PERMISSION, SOURCE } from 'common/constants';
import { logger } from 'common/logger';
import { truthySum } from 'common/util';
import { IdentifierType } from 'data/@types';
import { getSourceResolver } from 'resolvers';

class AddAction implements CommandAction {

  constructor(private readonly services: BotServices) {}

  async execute(context: CommandContext, params: CommandOptions): Promise<void> {
    const sum = truthySum(params.QUERY, params.URL, params.IDENTIFIER);
    if (sum === 0) {
      await context.message.reply('You must provide me a query, url, or identifier. Please try again.');
      return;
    } else if (sum > 1) {
      await context.message.reply('You must only include 1 query, url, or identifier. Please try again.');
      return;
    }

    try {
      if (params.IDENTIFIER) {
        const user = await context.user.get();
        if (!user.identifiers || !user.identifiers[params.IDENTIFIER]) {
          await context.message.reply(`That identifier is unrecognized!`);
          return;
        }
      } else {
        const resource = await getSourceResolver(context, params).resolve();
        if (resource) {
          await context.channel.send(`Selected **${resource.name}** by **${resource.authors.join(',')}**`
            + `\n(**${getEnumName(IdentifierType, resource.identifier.type)}**`
            + ` from **${getEnumName(SOURCE, resource.identifier.src)}**)`);
        }
      }
      await context.message.reply(`Could not find any tracks to add to the queue! Please try again.`);
    } catch (e) {
      logger.debug(e.stack || e);
      await context.message.reply(e.response || 'Sorry. Something broke real bad.');
    }
  }

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
  createAction: services => new AddAction(services)
};
