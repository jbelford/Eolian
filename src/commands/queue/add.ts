import { QueueCategory } from "commands/category";
import { KEYWORDS } from "commands/keywords";
import { getEnumName, IDENTIFIER_TYPE, PERMISSION, SOURCE } from 'common/constants';
import { logger } from 'common/logger';
import { Util } from 'common/util';
import * as resolvers from 'resolvers';

const info: CommandInfo = {
  name: 'add',
  details: 'Add songs to the queue',
  category: QueueCategory,
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
};

class AddAction implements CommandAction {

  constructor(private readonly services: CommandActionServices) {}

  async execute(context: CommandActionContext, params: CommandActionParams): Promise<any> {
    const sum = Util.tsum(params.QUERY, params.URL, params.IDENTIFIER);
    if (sum === 0) {
      return await context.message.reply('You must provide me a query, url, or identifier. Please try again.');
    } else if (sum > 1) {
      return await context.message.reply('You must only include 1 query, url, or identifier. Please try again.');
    }

    try {
      if (params.IDENTIFIER) {
        const user = await context.user.get();
        const identifier = user.identifiers[params.IDENTIFIER];
        if (!identifier) {
          return await context.message.reply(`That identifier is unrecognized!`);
        }
      } else {
        const resource = await resolvers.getSourceResolver(context, params).resolve();
        if (resource) {
          await context.channel.send(`Selected **${resource.name}** by **${resource.authors.join(',')}**`
            + `\n(**${getEnumName(IDENTIFIER_TYPE, resource.identifier.type)}**`
            + ` from **${getEnumName(SOURCE, resource.identifier.src)}**)`);
        }
      }
    } catch (e) {
      logger.debug(e.stack || e);
      return await context.message.reply(e.response || 'Sorry. Something broke real bad.');
    }

    await context.message.reply(`Could not find any tracks to add to the queue! Please try again.`);
  }

}

export const AddCommand: Command = {
  info,
  createAction(services) {
    return new AddAction(services);
  }
};
