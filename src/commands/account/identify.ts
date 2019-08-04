import { AccountCategory } from "commands/category";
import { KEYWORDS } from "commands/keywords";
import { PERMISSION } from 'common/constants';
import { logger } from "common/logger";
import * as identifiers from 'services/identifiers';


const info: CommandInfo = {
  name: 'identify',
  category: AccountCategory,
  details: 'Set a shortcut identifier for any song, playlist, album or artist from Spotify, SoundCloud, or YouTube',
  permission: PERMISSION.USER,
  keywords: [
    KEYWORDS.IDENTIFIER, KEYWORDS.URL, KEYWORDS.QUERY, KEYWORDS.MY, KEYWORDS.SOUNDCLOUD, KEYWORDS.SPOTIFY, KEYWORDS.YOUTUBE,
    KEYWORDS.PLAYLIST, KEYWORDS.ALBUM, KEYWORDS.ARTIST, KEYWORDS.FAVORITES, KEYWORDS.TRACKS
  ],
  usage: ['spotify playlist (retrowave) as [retro]'],
}

class IdentifyAction implements CommandAction {

  constructor(private readonly services: CommandActionServices) {}

  public async execute(context: CommandActionContext, params: CommandActionParams): Promise<any> {
    if (!params.IDENTIFIER) {
      return await context.message.reply(`You forgot to specify the key for your identifer.`);
    } else if (params.URL && params.QUERY) {
      return await context.message.reply(`You specified both a url and a query! Please try again with only one of those.`);
    }

    try {
      const resource = await identifiers.resolve(context, params);
      if (resource) {
        await this.services.users.addResourceIdentifier(context.user.id, params.IDENTIFIER, resource.identifier);
        const authors = resource.authors.join(',');
        return await context.message
          .reply(`Awesome! The resource \`${resource.name}\` by \`${authors}\` can now be identified with \`${params.IDENTIFIER}\`.`);
      }
    } catch (e) {
      logger.debug(e.stack || e);
      return await context.message.reply(e.response || 'Sorry. Something broke real bad.');
    }

    await context.message.reply(`You must provide me something to identify! Please try again with a URL or query.`);
  }

}

export const IdentifyCommand: Command = {
  info,
  createAction(services) {
    return new IdentifyAction(services);
  }
}