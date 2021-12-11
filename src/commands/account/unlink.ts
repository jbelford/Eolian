import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { ACCOUNT_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';

async function execute({ interaction }: CommandContext, { SOUNDCLOUD, SPOTIFY }: CommandOptions): Promise<void> {
  let response: string | undefined;

  if (SOUNDCLOUD || SPOTIFY) {
    await interaction.defer();
  }

  if (SOUNDCLOUD) {
    await interaction.user.setSoundCloud(null);
    response = 'I have unlinked any SoundCloud account if you had one';
  }

  if (SPOTIFY) {
    await interaction.user.setSpotify(null);
    if (response) {
      response += ' and I also unlinked your Spotify account if you had one';
    } else {
      response = 'I have unlinked any Spotify account if you had one';
    }
  }

  await interaction.reply(response || 'You need to specify the accounts you want me to unlink!');
}

export const UNLINK_COMMAND: Command = {
  name: 'unlink',
  category: ACCOUNT_CATEGORY,
  details: 'Remove a Spotify or SoundCloud account you are linked to.',
  permission: PERMISSION.USER,
  dmAllowed: true,
  keywords: [KEYWORDS.SOUNDCLOUD, KEYWORDS.SPOTIFY],
  usage: [
    {
      title: 'Unlink SoundCloud account',
      example: [KEYWORDS.SOUNDCLOUD]
    },
    {
      title: 'Unlink Spotify account',
      example: [KEYWORDS.SPOTIFY]
    },
    {
      title: 'Unlink Spotify and SoundCloud',
      example: [KEYWORDS.SOUNDCLOUD, KEYWORDS.SPOTIFY]
    }
  ],
  execute
};
