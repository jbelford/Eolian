import { createSpotifyClient, createSoundCloudClient, soundcloud, spotify } from '@eolian/api';
import { TrackSource } from '@eolian/api/@types';
import { SoundCloudUser } from '@eolian/api/soundcloud/@types';
import { SpotifyResourceType, SpotifyUser } from '@eolian/api/spotify/@types';
import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { logger } from '@eolian/common/logger';
import { feature } from '@eolian/data';
import { FeatureFlag } from '@eolian/data/@types';
import { SelectionOption } from '@eolian/embed/@types';
import { KEYWORDS, PATTERNS } from '@eolian/command-options';
import { CommandOptions, UrlArgument } from '@eolian/command-options/@types';
import { CommandContext, Command } from '../@types';
import { ACCOUNT_CATEGORY } from '../category';

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  if (options.SEARCH && options.URL) {
    throw new EolianUserError(
      `You provided both SEARCH and URL patterns. Please provide just one of those items.`,
    );
  }

  if (feature.enabled(FeatureFlag.SPOTIFY_AUTH) && options.SPOTIFY) {
    await context.interaction.defer();
    const request = await context.interaction.user.getRequest(
      context.interaction,
      TrackSource.Spotify,
    );
    const client = createSpotifyClient(request);
    const user = await client.getMe();
    await context.interaction.send(getSpotifyMessage(user));
  } else if (feature.enabled(FeatureFlag.SOUNDCLOUD_AUTH) && options.SOUNDCLOUD) {
    await context.interaction.defer();
    const request = await context.interaction.user.getRequest(
      context.interaction,
      TrackSource.SoundCloud,
    );
    const client = createSoundCloudClient(request);
    const user = await client.getMe();
    await context.interaction.send(getSoundCloudMessage(user));
  } else if (options.URL) {
    await context.interaction.defer();
    await handleUrl(options.URL, context);
  } else if (options.SEARCH) {
    if (options.SPOTIFY) {
      throw new EolianUserError(
        `Sorry. Spotify doesn't allow me to search for profiles. Provide me a URL instead.`,
      );
    }
    await context.interaction.defer();
    await handleSoundCloudQuery(context, options.SEARCH);
  } else {
    throw new EolianUserError(
      'You must provide valid URL or SEARCH for me to link your account to!',
    );
  }
}

async function handleUrl(url: UrlArgument, context: CommandContext) {
  switch (url.source) {
    case TrackSource.Spotify:
      await handleSpotifyUrl(url.value, context);
      break;
    case TrackSource.SoundCloud:
      await handleSoundCloudUrl(url.value, context);
      break;
    default:
      logger.warn(`A URL was provided without a valid source. This should not happen: %s`, url);
      throw new EolianUserError('The URL you provided does not match any source.');
  }
}

async function handleSpotifyUrl(url: string, context: CommandContext) {
  if (feature.enabled(FeatureFlag.SPOTIFY_AUTH)) {
    throw new EolianUserError(
      `You don't need to provide a link! Just provide the \`${KEYWORDS.SPOTIFY.name}\` keyword!`,
    );
  }

  const resource = spotify.resolve(url);
  if (!resource || resource.type !== SpotifyResourceType.USER) {
    throw new EolianUserError('Spotify resource is not a user!');
  }

  const spotifyUser = await spotify.getUser(resource.id);
  await context.interaction.user.setSpotify(spotifyUser.id);
  await context.interaction.send(getSpotifyMessage(spotifyUser));
}

function getSpotifyMessage(user: SpotifyUser): string {
  return (
    `I have set your Spotify account to \`${user.display_name}\`!` +
    ` You can now use the \`${KEYWORDS.MY.name}\` keyword combined with the \`${KEYWORDS.SPOTIFY.name}\`` +
    ` keyword to search your playlists.`
  );
}

async function handleSoundCloudUrl(url: string, context: CommandContext) {
  const soundCloudUser = await soundcloud.resolveUser(url);
  const message = await handleSoundCloud(context, soundCloudUser);
  await context.interaction.send(message);
}

async function handleSoundCloudQuery(context: CommandContext, query: string) {
  const soundCloudUsers = await soundcloud.searchUser(query);
  if (soundCloudUsers.length === 0) {
    throw new EolianUserError(`I searched SoundCloud but found nothing for \`${query}\``);
  }

  const question = 'Which SoundCloud account do you want me to link?';
  const options: SelectionOption[] = soundCloudUsers.map(user => ({
    name: user.username,
    subname: user.permalink_url,
    url: user.permalink_url,
  }));
  const result = await context.interaction.sendSelection(
    question,
    options,
    context.interaction.user,
  );

  const message = await handleSoundCloud(context, soundCloudUsers[result.selected]);
  await result.message.edit(message);
}

async function handleSoundCloud(
  context: CommandContext,
  soundCloudUser: SoundCloudUser,
): Promise<string> {
  await context.interaction.user.setSoundCloud(soundCloudUser.id);
  return getSoundCloudMessage(soundCloudUser);
}

function getSoundCloudMessage(user: SoundCloudUser): string {
  return (
    `I have set your SoundCloud account to \`${user.username}\`!` +
    ` You can now use the \`${KEYWORDS.MY.name}\` keyword combined with the \`${KEYWORDS.SOUNDCLOUD.name}\` keyword` +
    ` to use your playlists, likes, and tracks.`
  );
}

export const LINK_COMMAND: Command = {
  name: 'link',
  shortName: 'ln',
  category: ACCOUNT_CATEGORY,
  details:
    'Link your Spotify or SoundCloud account.\n If a SEARCH query is provided, will search SoundCloud.',
  permission: UserPermission.User,
  dmAllowed: true,
  keywords: [KEYWORDS.SPOTIFY, KEYWORDS.SOUNDCLOUD],
  patterns: [PATTERNS.SEARCH, PATTERNS.URL],
  usage: [
    {
      title: `Search for SoundCloud user to link`,
      example: [KEYWORDS.SOUNDCLOUD, PATTERNS.SEARCH.ex('john smith')],
    },
    {
      title: 'Provide URL to SoundCloud user to link',
      example: [PATTERNS.URL.ex('https://soundcloud.com/john-smith')],
    },
    {
      title: 'Provide URL to Spotify user to link',
      example: [PATTERNS.URL.ex('https://open.spotify.com/user/1111111111?si=1111111111111')],
      hide: feature.enabled(FeatureFlag.SPOTIFY_AUTH),
    },
    {
      title: 'Authenticate with Spotify',
      example: [KEYWORDS.SPOTIFY],
      hide: !feature.enabled(FeatureFlag.SPOTIFY_AUTH),
    },
  ],
  execute,
};
