import { AccountCategory } from "commands/command";
import { KEYWORDS } from "commands/keywords";
import { PERMISSION } from 'common/constants';
import { logger } from "common/logger";

const info: CommandInfo = {
  name: 'unlink',
  category: AccountCategory,
  details: 'Remove a Spotify or SoundCloud account you are linked to.',
  permission: PERMISSION.USER,
  keywords: [KEYWORDS.SOUNDCLOUD, KEYWORDS.SPOTIFY],
  usage: ['soundcloud', 'spotify', 'soundcloud spotify'],
};

class UnlinkAction implements CommandAction {

  info = info;

  constructor(private readonly services: CommandActionServices) {}

  public async execute({ message, user }: CommandActionContext, { SOUNDCLOUD, SPOTIFY }: CommandActionParams): Promise<any> {
    let response: string;
    if (SOUNDCLOUD) {
      try {
        await this.services.users.unlinkSoundCloudAccount(user.id);
        response = 'I have unlinked any SoundCloud account if you had one';
      } catch (e) {
        logger.warn(e.message);
        return await message.reply(e.response);
      }
    }
    if (SPOTIFY) {
      try {
        await this.services.users.unlinkSpotifyAccount(user.id);
        if (response) response += ' and I also unlinked your Spotify account if you had one';
        else response = 'I have unlinked any Spotify account if you had one';
      } catch (e) {
        logger.warn(e.message);
        return await message.reply(e.response);
      }
    }
    response ? await message.reply(response)
      : await message.reply('You need to specify the accounts you want me to unlink!');
  }

}

export const UnlinkCommand: Command = {
  info,
  action: UnlinkAction
}
