import { TrackSource } from '@eolian/api/@types';
import { UserPermission } from '@eolian/common/constants';
import { feature } from '@eolian/data';
import { FeatureFlag } from '@eolian/data/@types';
import { KEYWORDS } from '@eolian/command-options';
import { CommandOptions } from '@eolian/command-options/@types';
import { CommandContext, Command } from '../@types';
import { ACCOUNT_CATEGORY } from '../category';

async function execute(
  { interaction }: CommandContext,
  { SOUNDCLOUD, SPOTIFY }: CommandOptions,
): Promise<void> {
  let response: string | undefined;

  if (SOUNDCLOUD || SPOTIFY) {
    await interaction.defer();
  }

  if (SOUNDCLOUD) {
    if (feature.enabled(FeatureFlag.SOUNDCLOUD_AUTH)) {
      await interaction.user.setToken(null, TrackSource.SoundCloud);
    } else {
      await interaction.user.setSoundCloud(null);
    }
    response = 'I have unlinked any SoundCloud account if you had one';
  }

  if (SPOTIFY) {
    if (feature.enabled(FeatureFlag.SPOTIFY_AUTH)) {
      await interaction.user.setToken(null, TrackSource.Spotify);
    } else {
      await interaction.user.setSpotify(null);
    }
    if (response) {
      response += ' and I also unlinked your Spotify account if you had one';
    } else {
      response = 'I have unlinked any Spotify account if you had one';
    }
  }

  await interaction.send(response || 'You need to specify the accounts you want me to unlink!');
}

export const UNLINK_COMMAND: Command = {
  name: 'unlink',
  shortName: 'ul',
  category: ACCOUNT_CATEGORY,
  details: 'Remove a Spotify or SoundCloud account you are linked to.',
  permission: UserPermission.User,
  dmAllowed: true,
  keywords: [KEYWORDS.SOUNDCLOUD, KEYWORDS.SPOTIFY],
  usage: [
    {
      title: 'Unlink SoundCloud account',
      example: [KEYWORDS.SOUNDCLOUD],
    },
    {
      title: 'Unlink Spotify account',
      example: [KEYWORDS.SPOTIFY],
    },
    {
      title: 'Unlink Spotify and SoundCloud',
      example: [KEYWORDS.SOUNDCLOUD, KEYWORDS.SPOTIFY],
    },
  ],
  execute,
};
