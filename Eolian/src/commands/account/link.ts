import { SoundCloud } from "../../api/soundcloud";
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
      if (URL.source === SOURCE.SPOTIFY) return await this.handleSpotify(context, URL.value);
      else if (URL.source === SOURCE.SOUNDCLOUD) return await this.handleSoundCloudUrl(context, URL.value);
      logger.warn(`A URL was provided without a valid source. This should not happen: ${URL}`);
      return await context.message.reply('The URL you provided does not match any source.');
    } else if (QUERY) {
      return await this.handleSoundCloudQuery(context, QUERY);
    }
    await context.message.reply('You must provide valid url or a query for me to link your account to!');
  }

  private async handleSpotify(context: CommandActionContext, url: string) {
    try {
      const spotifyUser = await Spotify.getUser(url);
      await this.services.users.linkSpotifyAccount(context.user.id, spotifyUser.id);
      await context.channel.send(`I have set your Spotify account to \`${spotifyUser.display_name}\`!`
        + ` You can now use the \`${KEYWORDS.MY.name}\` keyword combined with the \`${KEYWORDS.SPOTIFY.name}\` keyword to search your playlists.`);
    } catch (e) {
      logger.warn(e.message);
      await context.message.reply(e.response);
    }
  }

  private async handleSoundCloudUrl(context: CommandActionContext, url: string) {
    try {
      const soundCloudUser = await SoundCloud.resolveUser(url);
      await this.handleSoundCloud(context, soundCloudUser);
    } catch (e) {
      logger.warn(e.message);
      await context.message.reply(e.response);
    }
  }

  private async handleSoundCloudQuery(context: CommandActionContext, query: string) {
    try {
      const soundCloudUsers = await SoundCloud.searchUser(query);
      if (soundCloudUsers.length === 0) return await context.message.reply(`I searched SoundCloud but found nothing for \`${query}\``);

      const question = 'Which SoundCloud account do you want me to link?';
      const options = soundCloudUsers.map(user => `${user.username} - ${user.permalink_url}`);
      const idx = await context.channel.sendSelection(question, options, context.user.id);
      if (idx === null) return;

      await this.handleSoundCloud(context, soundCloudUsers[idx]);
    } catch (e) {
      logger.warn(e.message);
      await context.message.reply(e.response);
    }
  }

  private async handleSoundCloud(context: CommandActionContext, soundCloudUser: SoundCloudUser) {
    await this.services.users.linkSoundCloudAccount(context.user.id, soundCloudUser.id);
    await context.channel.send(`I have set your Spotify account to \`${soundCloudUser.username}\`!`
      + ` You can now use the \`${KEYWORDS.MY.name}\` keyword combined with the \`${KEYWORDS.SOUNDCLOUD.name}\` keyword`
      + ` to use your playlists, favorites, and tracks.`);
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