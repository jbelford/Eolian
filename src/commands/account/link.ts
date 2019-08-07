import { soundcloud, spotify } from 'api';
import { SoundCloudUser } from 'api/soundcloud';
import { SpotifyResourceType } from 'api/spotify';
import { BotServices, Command, CommandAction, CommandContext, CommandOptions } from 'commands/@types';
import { ACCOUNT_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION, SOURCE } from 'common/constants';
import { EolianBotError } from 'common/errors';
import { logger } from 'common/logger';

class LinkAction implements CommandAction {

  constructor(private readonly services: BotServices) {}

  async execute(context: CommandContext, { QUERY, URL, SPOTIFY }: CommandOptions): Promise<void> {
    if (QUERY && URL) {
      return context.message.reply(`You provided both a query and a url. Please provide just one of those items.`);
    } else if (URL) {
      switch (URL.source) {
        case SOURCE.SPOTIFY:
            return this.handleSpotifyUrl(context, URL.value);
        case SOURCE.SOUNDCLOUD:
            return this.handleSoundCloudUrl(context, URL.value);
        default:
            logger.warn(`A URL was provided without a valid source. This should not happen: ${URL}`);
            return context.message.reply('The URL you provided does not match any source.');
      }
    } else if (QUERY) {
      if (SPOTIFY) {
        return context.message.reply(`Sorry. Spotify doesn't allow me to search for profiles. Provide me a URL instead.`);
      }
      return this.handleSoundCloudQuery(context, QUERY);
    }
    await context.message.reply('You must provide valid url or a query for me to link your account to!');
  }

  private async handleSpotifyUrl(context: CommandContext, url: string) {
    try {
      const resource = spotify.resolve(url);
      if (!resource || resource.type !== SpotifyResourceType.USER) throw new EolianBotError('Spotify resource is not a user!');

      const spotifyUser = await spotify.getUser(resource.id);
      await this.services.users.linkSpotifyAccount(context.user.id, spotifyUser.id);
      await context.channel.send(`I have set your Spotify account to \`${spotifyUser.display_name}\`!`
        + ` You can now use the \`${KEYWORDS.MY.name}\` keyword combined with the \`${KEYWORDS.SPOTIFY.name}\` keyword to search your playlists.`);
    } catch (e) {
      logger.warn(e.message);
      await context.message.reply(e.response);
    }
  }

  private async handleSoundCloudUrl(context: CommandContext, url: string) {
    try {
      const soundCloudUser = await soundcloud.resolveUser(url);
      await this.handleSoundCloud(context, soundCloudUser);
    } catch (e) {
      logger.warn(e.message);
      await context.message.reply(e.response);
    }
  }

  private async handleSoundCloudQuery(context: CommandContext, query: string) {
    try {
      const soundCloudUsers = await soundcloud.searchUser(query);
      if (soundCloudUsers.length === 0) return await context.message.reply(`I searched SoundCloud but found nothing for \`${query}\``);

      const question = 'Which SoundCloud account do you want me to link?';
      const options = soundCloudUsers.map(user => `${user.username} - ${user.permalink_url}`);
      const idx = await context.channel.sendSelection(question, options, context.user.id);
      if (idx === undefined) return;

      await this.handleSoundCloud(context, soundCloudUsers[idx]);
    } catch (e) {
      logger.warn(e.message);
      await context.message.reply(e.response);
    }
  }

  private async handleSoundCloud(context: CommandContext, soundCloudUser: SoundCloudUser) {
    await this.services.users.linkSoundCloudAccount(context.user.id, soundCloudUser.id);
    await context.channel.send(`I have set your SoundCloud account to \`${soundCloudUser.username}\`!`
      + ` You can now use the \`${KEYWORDS.MY.name}\` keyword combined with the \`${KEYWORDS.SOUNDCLOUD.name}\` keyword`
      + ` to use your playlists, favorites, and tracks.`);
  }

}

export const LINK_COMMAND: Command = {
  name: 'link',
  category: ACCOUNT_CATEGORY,
  details: 'Link your Spotify or SoundCloud account.\n If a query is provided, will search SoundCloud.',
  permission: PERMISSION.USER,
  keywords: [KEYWORDS.QUERY, KEYWORDS.URL],
  usage: ['soundcloud (jack belford)', 'https://soundcloud.com/jack-belford-1'],
  createAction: services => new LinkAction(services)
}