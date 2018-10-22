import { SoundCloud } from "api/soundcloud";
import { Spotify } from "api/spotify";
import { AccountCategory, CommandAction } from "commands/command";
import { KEYWORDS } from "commands/keywords";
import { PERMISSION } from "common/constants";
import { Embed } from "common/embed";
import { logger } from "common/logger";

class AccountAction extends CommandAction {

  public async execute(context: CommandActionContext, params: CommandActionParams): Promise<any> {
    if (params.CLEAR) return this.clearUserData(context);
    let embed: EmbedMessage;
    try {
      const user = await this.services.users.getUser(context.user.id);
      const spotify = user.spotify ? await Spotify.getUser(user.spotify) : null;
      const soundCloud = user.soundcloud ? await SoundCloud.getUser(user.soundcloud) : null;
      embed = Embed.userDetails(context.user, spotify, soundCloud, user.identifiers);
    } catch (e) {
      logger.warn(e.stack || e);
      return await context.message.reply(e.response || 'Sorry. Something went wrong fetching your account details.');
    }
    await context.channel.sendEmbed(embed);
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
  name: 'account',
  category: AccountCategory,
  details: 'Show your account details. Including linked music accounts and identifiers',
  keywords: [KEYWORDS.CLEAR],
  permission: PERMISSION.USER,
  usage: ['', 'clear'],
  action: AccountAction
};