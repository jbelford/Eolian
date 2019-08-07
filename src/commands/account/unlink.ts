import { BotServices, Command, CommandAction, CommandContext, CommandOptions } from 'commands/@types';
import { ACCOUNT_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { logger } from 'common/logger';

class UnlinkAction implements CommandAction {

  constructor(private readonly services: BotServices) {}

  async execute({ message, user }: CommandContext, { SOUNDCLOUD, SPOTIFY }: CommandOptions): Promise<void> {
    let response: string | undefined;

    if (SOUNDCLOUD) {
      try {
        await this.services.users.unlinkSoundCloudAccount(user.id);
        response = 'I have unlinked any SoundCloud account if you had one';
      } catch (e) {
        logger.warn(e.message);
        return message.reply(e.response);
      }
    }

    if (SPOTIFY) {
      try {
        await this.services.users.unlinkSpotifyAccount(user.id);
        if (response) response += ' and I also unlinked your Spotify account if you had one';
        else response = 'I have unlinked any Spotify account if you had one';
      } catch (e) {
        logger.warn(e.message);
        return message.reply(e.response);
      }
    }

    await message.reply(response || 'You need to specify the accounts you want me to unlink!');
  }

}

export const UNLINK_COMMAND: Command = {
  name: 'unlink',
  category: ACCOUNT_CATEGORY,
  details: 'Remove a Spotify or SoundCloud account you are linked to.',
  permission: PERMISSION.USER,
  keywords: [KEYWORDS.SOUNDCLOUD, KEYWORDS.SPOTIFY],
  usage: ['soundcloud', 'spotify', 'soundcloud spotify'],
  createAction: services => new UnlinkAction(services)
};
