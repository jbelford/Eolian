import { soundcloud } from 'api/soundcloud';
import { spotify } from 'api/spotify';
import { ACCOUNT_CATEGORY } from "commands/category";
import { KEYWORDS } from "commands/keywords";
import { PERMISSION } from 'common/constants';
import { logger } from "common/logger";
import { userDetails } from 'embed';

const info: CommandInfo = {
  name: 'me',
  details: 'Show your account details. Including linked music accounts and identifiers',
  permission: PERMISSION.USER,
  category: ACCOUNT_CATEGORY,
  keywords: [KEYWORDS.CLEAR],
  usage: ['', 'clear']
};

class AccountAction implements CommandAction {

  constructor(private readonly services: CommandActionServices) {}

  async execute(context: CommandActionContext, params: CommandActionParams): Promise<void> {
    if (params.CLEAR) {
      return this.clearUserData(context);
    }
    try {
      const user = await this.services.users.getUser(context.user.id);
      const spotifyAccount = user && user.spotify ? await spotify.api.getUser(user.spotify) : undefined;
      const soundCloudAccount = user && user.soundcloud ? await soundcloud.api.getUser(user.soundcloud) : undefined;
      const message = userDetails(context.user, spotifyAccount, soundCloudAccount, user && user.identifiers);
      await context.channel.sendEmbed(message);
    } catch (e) {
      logger.warn(e.stack || e);
      await context.message.reply(e.response || 'Sorry. Something went wrong fetching your account details.');
    }
  }

  private async clearUserData(context: CommandActionContext): Promise<void> {
    try {
      const removed = await this.services.users.removeUser(context.user.id);
      return context.message.reply(removed ? 'Okay! I have erased my knowledge about you entirely.'
        : `I already don't know anything about you`);
    } catch (e) {
      logger.warn(e.stack || e);
      return context.message.reply(e.response || 'Sorry. Something went wrong removing your data.');
    }
  }

}

export const ACCOUNT_COMMAND: Command = {
  info,
  createAction(services) {
    return new AccountAction(services);
  }
}


