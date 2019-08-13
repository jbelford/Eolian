import { Command, CommandAction, CommandContext, CommandOptions } from 'commands/@types';
import { ACCOUNT_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { getSourceResolver } from 'resolvers';

class IdentifyAction implements CommandAction {

  async execute(context: CommandContext, options: CommandOptions): Promise<void> {
    if (!options.IDENTIFIER) {
      throw new EolianUserError(`You forgot to specify the key for your identifer.`);
    } else if (options.URL && options.QUERY) {
      throw new EolianUserError(`You specified both a url and a query! Please try again with only one of those.`);
    }

    const resource = await getSourceResolver(context, options).resolve();
    if (!resource) {
      throw new EolianUserError(`You must provide me something to identify! Please try again with a URL or query.`);
    }

    await context.user.setIdentifier(options.IDENTIFIER, resource.identifier);
    const response = `Awesome! The resource \`${resource.name}\` by \`${resource.authors.join(',')}\``
        + ` can now be identified with \`${options.IDENTIFIER}\`.`;
    await context.message.reply(response);
   }

}

export const IDENTIFY_COMMAND: Command = {
  name: 'identify',
  category: ACCOUNT_CATEGORY,
  details: 'Set a shortcut identifier for any song, playlist, album or artist from Spotify, SoundCloud, or YouTube',
  permission: PERMISSION.USER,
  keywords: [
    KEYWORDS.IDENTIFIER, KEYWORDS.URL, KEYWORDS.QUERY, KEYWORDS.MY, KEYWORDS.SOUNDCLOUD, KEYWORDS.SPOTIFY, KEYWORDS.YOUTUBE,
    KEYWORDS.PLAYLIST, KEYWORDS.ALBUM, KEYWORDS.ARTIST, KEYWORDS.FAVORITES, KEYWORDS.TRACKS
  ],
  usage: ['spotify playlist (retrowave) as [retro]'],
  createAction: () => new IdentifyAction()
};