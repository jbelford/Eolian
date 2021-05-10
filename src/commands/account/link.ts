import { soundcloud, spotify } from 'api';
import { SoundCloudUser, SpotifyResourceType } from 'api/@types';
import { Command, CommandContext, CommandOptions, UrlArgument } from 'commands/@types';
import { ACCOUNT_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION, SOURCE } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { logger } from 'common/logger';

async function execute(context: CommandContext, { QUERY, URL, SPOTIFY }: CommandOptions): Promise<void> {
  if (QUERY && URL) {
    throw new EolianUserError(`You provided both a query and a url. Please provide just one of those items.`);
  }

  if (URL) {
    await handleUrl(URL, context);
  } else if (QUERY) {
    if (SPOTIFY) {
      throw new EolianUserError(`Sorry. Spotify doesn't allow me to search for profiles. Provide me a URL instead.`);
    }
    await handleSoundCloudQuery(context, QUERY);
  } else {
    throw new EolianUserError('You must provide valid url or a query for me to link your account to!');
  }
}

async function handleUrl(URL: UrlArgument, context: CommandContext) {
  switch (URL.source) {
    case SOURCE.SPOTIFY:
      await handleSpotifyUrl(URL.value, context);
      break;
    case SOURCE.SOUNDCLOUD:
      await handleSoundCloudUrl(URL.value, context);
      break;
    default:
      logger.warn(`A URL was provided without a valid source. This should not happen: ${URL}`);
      throw new EolianUserError('The URL you provided does not match any source.');
  }
}

async function handleSpotifyUrl(url: string, context: CommandContext) {
  const resource = spotify.resolve(url);
  if (!resource || resource.type !== SpotifyResourceType.USER) {
    throw new EolianUserError('Spotify resource is not a user!');
  }

  const spotifyUser = await spotify.getUser(resource.id);
  await context.user.setSpotify(spotifyUser.id);
  await context.channel.send(`I have set your Spotify account to \`${spotifyUser.display_name}\`!`
    + ` You can now use the \`${KEYWORDS.MY.name}\` keyword combined with the \`${KEYWORDS.SPOTIFY.name}\``
    + ` keyword to search your playlists.`);
}

async function handleSoundCloudUrl(url: string, context: CommandContext) {
  const soundCloudUser = await soundcloud.resolveUser(url);
  await handleSoundCloud(context, soundCloudUser);
}

async function handleSoundCloudQuery(context: CommandContext, query: string) {
  const soundCloudUsers = await soundcloud.searchUser(query);
  if (soundCloudUsers.length === 0) {
    throw new EolianUserError(`I searched SoundCloud but found nothing for \`${query}\``);
  }

  const question = 'Which SoundCloud account do you want me to link?';
  const options = soundCloudUsers.map(user => `${user.username} - ${user.permalink_url}`);
  const idx = await context.channel.sendSelection(question, options, context.user);
  if (idx < 0) {
    context.message.reply('The selection has been cancelled');
    return;
  }

  await handleSoundCloud(context, soundCloudUsers[idx]);
}

async function handleSoundCloud(context: CommandContext, soundCloudUser: SoundCloudUser) {
  await context.user.setSoundCloud(soundCloudUser.id);
  await context.channel.send(`I have set your SoundCloud account to \`${soundCloudUser.username}\`!`
    + ` You can now use the \`${KEYWORDS.MY.name}\` keyword combined with the \`${KEYWORDS.SOUNDCLOUD.name}\` keyword`
    + ` to use your playlists, favorites, and tracks.`);
}

export const LINK_COMMAND: Command = {
  name: 'link',
  category: ACCOUNT_CATEGORY,
  details: 'Link your Spotify or SoundCloud account.\n If a query is provided, will search SoundCloud.',
  permission: PERMISSION.USER,
  keywords: [KEYWORDS.QUERY, KEYWORDS.URL],
  usage: ['soundcloud (jack belford)', 'https://soundcloud.com/jack-belford-1'],
  execute
};