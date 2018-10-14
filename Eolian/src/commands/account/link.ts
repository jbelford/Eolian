import { Spotify } from "../../api/spotify";
import { PERMISSION, SOURCE } from "../../common/constants";
import { logger } from "../../common/logger";
import { AccountCategory, CommandAction } from "../command";
import { KEYWORDS } from "../keywords";

class LinkAction extends CommandAction {

  public async execute(context: CommandActionContext, { QUERY, URL }: CommandActionParams): Promise<void> {
    if (QUERY && URL) {
      return await context.message.reply(`You provided both a query and a url. Please provide just one of those items.`);
    } else if (URL) {
      if (URL.source === SOURCE.SPOTIFY) {
        return await this.handleSpotify(context, URL.value);
      }
      logger.warn(`A URL was provided without a valid source. This should not happen: ${URL}`);
      return await context.message.reply('The URL you provided does not match any source.');
    } else if (QUERY) {

    }
    await context.message.reply('You must provide valid url or a query for me to link your account to!');
  }

  private async handleSpotify(context: CommandActionContext, url: string) {
    let [spotifyUser, err] = await Spotify.getUser(url);
    if (err) {
      logger.debug(err.message);
      return await context.message.reply(err.response);
    }
    err = await this.services.users.linkSpotifyAccount(context.user.id, spotifyUser.id);
    if (err) {
      logger.error(err.message);
      return await context.message.reply(err.response);
    }
    await context.channel.send(`I have set your Spotify account to \`${spotifyUser.display_name}\`!`
      + ` You can now use the \`${KEYWORDS.MY.name}\` keyword combined with the \`${KEYWORDS.SPOTIFY.name}\` keyword to search your playlists.`)
  }

}

export const LinkCommand: Command = {
  name: 'link',
  category: AccountCategory,
  details: 'Link your Spotify or SoundCloud account.\n If a query is provided, will search SoundCloud.',
  permission: PERMISSION.USER,
  keywords: [KEYWORDS.QUERY, KEYWORDS.URL],
  usage: ['soundcloud (jack belford)', 'https://soundcloud.com/jack-belford-1'],
  action: LinkAction
};