import { createSpotifyClient, soundcloud, spotify } from 'api';
import { SpotifyUser } from 'api/@types';
import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { ACCOUNT_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { UserPermission } from 'common/constants';
import { feature } from 'data';
import { FeatureFlag } from 'data/@types';
import { createUserDetailsEmbed } from 'embed';

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
        const request = await context.interaction.user.getSpotifyRequest();
        const client = createSpotifyClient(request);
        spotifyAccount = await client.getMe();
      }
    } else {
      spotifyAccount = user && user.spotify ? await spotify.getUser(user.spotify) : undefined;
    }
    const soundCloudAccount = user.soundcloud
      ? await soundcloud.getUser(user.soundcloud)
      : undefined;

    const message = createUserDetailsEmbed(
      context.interaction.user,
      spotifyAccount,
      soundCloudAccount,
      user && user.identifiers
    );

    await defer;
    await context.interaction.sendEmbed(message);
  }
}

export const ACCOUNT_COMMAND: Command = {
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
