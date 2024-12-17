import { createSpotifyClient, createSoundCloudClient, soundcloud, spotify } from '@eolian/api';
import { TrackSource } from '@eolian/api/@types';
import { SoundCloudUser } from '@eolian/api/soundcloud/@types';
import { SpotifyUser } from '@eolian/api/spotify/@types';
import { UserPermission } from '@eolian/common/constants';
import { feature } from '@eolian/data';
import { FeatureFlag } from '@eolian/data/@types';
import { createUserDetailsEmbed } from '@eolian/embed';
import { KEYWORDS } from '@eolian/command-options';
import { CommandOptions } from '@eolian/command-options/@types';
import { CommandContext, Command } from '../@types';
import { ACCOUNT_CATEGORY } from '../category';

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  if (options.CLEAR) {
    const removed = await context.interaction.user.clearData();
    const response = removed
      ? 'Okay! I have erased my knowledge about you entirely.'
      : `I already don't know anything about you`;
    await context.interaction.send(response);
  } else {
    const defer = context.interaction.defer();

    const user = await context.interaction.user.get();
    let spotifyAccount: SpotifyUser | undefined;
    if (feature.enabled(FeatureFlag.SPOTIFY_AUTH)) {
      if (user.tokens?.spotify) {
        const request = await context.interaction.user.getRequest(
          context.interaction,
          TrackSource.Spotify,
        );
        const client = createSpotifyClient(request);
        spotifyAccount = await client.getMe();
      }
    } else {
      spotifyAccount = user && user.spotify ? await spotify.getUser(user.spotify) : undefined;
    }

    let soundcloudAccount: SoundCloudUser | undefined;
    if (feature.enabled(FeatureFlag.SOUNDCLOUD_AUTH)) {
      if (user.tokens?.soundcloud) {
        const request = await context.interaction.user.getRequest(
          context.interaction,
          TrackSource.SoundCloud,
        );
        const client = createSoundCloudClient(request);
        soundcloudAccount = await client.getMe();
      }
    } else {
      soundcloudAccount = user.soundcloud ? await soundcloud.getUser(user.soundcloud) : undefined;
    }

    const message = createUserDetailsEmbed(
      context.interaction.user,
      spotifyAccount,
      soundcloudAccount,
      user?.identifiers,
      user?.syntax,
    );

    await defer;
    await context.interaction.sendEmbed(message);
  }
}

export const ME_COMMAND: Command = {
  name: 'me',
  details: 'Show your account details. Including linked music accounts and identifiers.',
  permission: UserPermission.User,
  category: ACCOUNT_CATEGORY,
  dmAllowed: true,
  keywords: [KEYWORDS.CLEAR],
  usage: [
    {
      title: 'Show profile',
      example: '',
    },
    {
      title: `Remove all links and identifiers`,
      example: [KEYWORDS.CLEAR],
    },
  ],
  execute,
};
