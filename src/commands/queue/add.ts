import { QueueCategory } from "commands/category";
import { KEYWORDS } from "commands/keywords";
import { PERMISSION } from 'common/constants';
import { Util } from 'common/util';
import * as identifiers from 'services/identifiers';

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
    if (Util.tsum(params.QUERY, params.URL, params.IDENTIFIER) > 1) {
      return await context.message.reply('You must only include 1 query, url, or identifier. Please try again.');
    }

    try {
      const resource = await identifiers.resolve(context, params);
      if (resource) {

      }

    } catch (e) {

    }
  }

}

export const AddCommand: Command = {
  info,
  createAction(services) {
    return new AddAction(services);
  }
};
