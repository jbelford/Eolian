import { SoundCloud } from "api/soundcloud";
import { Spotify, SpotifyResourceType } from "api/spotify";
import { AccountCategory } from "commands/command";
import { KEYWORDS } from "commands/keywords";
import { EolianBotError } from "common/errors";
import { logger } from "common/logger";

export default class LinkAction implements ICommandAction {

  name = 'link';
  category = AccountCategory;
  details = 'Link your Spotify or SoundCloud account.\n If a query is provided, will search SoundCloud.';
  permission = PERMISSION.USER;
  keywords = [KEYWORDS.QUERY, KEYWORDS.URL];
  usage = ['soundcloud (jack belford)', 'https://soundcloud.com/jack-belford-1'];

  constructor(private readonly services: CommandActionServices) {}

  public async execute(context: CommandActionContext, { QUERY, URL, SPOTIFY }: CommandActionParams): Promise<void> {
    if (QUERY && URL) {
      return await context.message.reply(`You provided both a query and a url. Please provide just one of those items.`);
    } else if (URL) {
      if (URL.source === SOURCE.SPOTIFY) return await this.handleSpotifyUrl(context, URL.value);
      else if (URL.source === SOURCE.SOUNDCLOUD) return await this.handleSoundCloudUrl(context, URL.value);
      logger.warn(`A URL was provided without a valid source. This should not happen: ${URL}`);
      return await context.message.reply('The URL you provided does not match any source.');
    } else if (QUERY) {
      if (SPOTIFY) {
        return await context.message.reply(`Sorry. Spotify doesn't allow me to search for profiles. Provide me a URL instead.`);
      }
      return await this.handleSoundCloudQuery(context, QUERY);
    }
    await context.message.reply('You must provide valid url or a query for me to link your account to!');
  }

  private async handleSpotifyUrl(context: CommandActionContext, url: string) {
    try {
      const resource = Spotify.getResourceType(url);
      if (!resource || resource.type !== SpotifyResourceType.USER) throw new EolianBotError('Spotify resource is not a user!');

      const spotifyUser = await Spotify.getUser(resource.id);
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
    await context.channel.send(`I have set your SoundCloud account to \`${soundCloudUser.username}\`!`
      + ` You can now use the \`${KEYWORDS.MY.name}\` keyword combined with the \`${KEYWORDS.SOUNDCLOUD.name}\` keyword`
      + ` to use your playlists, favorites, and tracks.`);
  }

}
