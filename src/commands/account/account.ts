import { SoundCloud } from "api/soundcloud";
import { Spotify } from "api/spotify";
import { AccountCategory } from "commands/category";
import { KEYWORDS } from "commands/keywords";
import { PERMISSION } from 'common/constants';
import { Embed } from "common/embed";
import { logger } from "common/logger";

const info: CommandInfo = {
  name: 'me',
  details: 'Show your account details. Including linked music accounts and identifiers',
  permission: PERMISSION.USER,
  category: AccountCategory,
  keywords: [KEYWORDS.CLEAR],
  usage: ['', 'clear']
};

class AccountAction implements CommandAction {

  constructor(private readonly services: CommandActionServices) {}

  public async execute(context: CommandActionContext, params: CommandActionParams): Promise<any> {
    if (params.CLEAR) {
      return this.clearUserData(context);
    }
    try {
      const user = await this.services.users.getUser(context.user.id);
      const spotify = user && user.spotify ? await Spotify.API.getUser(user.spotify) : null;
      const soundCloud = user && user.soundcloud ? await SoundCloud.API.getUser(user.soundcloud) : null;
      const embed = Embed.userDetails(context.user, spotify, soundCloud, user && user.identifiers);
      await context.channel.sendEmbed(embed);
    } catch (e) {
      logger.warn(e.stack || e);
      await context.message.reply(e.response || 'Sorry. Something went wrong fetching your account details.');
    }
  }

  private async clearUserData(context: CommandActionContext) {
    try {
      const removed = await this.services.users.removeUser(context.user.id);
      return await context.message.reply(removed ? 'Okay! I have erased my knowledge about you entirely.'
        : `I already don't know anything about you`);
    } catch (e) {
      logger.warn(e.stack || e);
      return await context.message.reply(e.response || 'Sorry. Something went wrong removing your data.');
    }
  }

}

export const AccountCommand: Command = {
  info,
  createAction(services) {
    return new AccountAction(services);
  }
}


