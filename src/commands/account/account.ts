import { soundcloud, spotify } from 'api';
import { BotServices, Command, CommandAction, CommandContext, CommandOptions } from 'commands/@types';
import { ACCOUNT_CATEGORY } from 'commands/category';
import { KEYWORDS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';
import { createUserDetailsEmbed } from 'embed';

class AccountAction implements CommandAction {

  constructor(private readonly services: BotServices) {}

  async execute(context: CommandContext, options: CommandOptions): Promise<void> {
    if (options.CLEAR) {
      await this.clearUserData(context);
    } else {
      const user = await context.user.get();
      const spotifyAccount = user && user.spotify ? await spotify.getUser(user.spotify) : undefined;
      const soundCloudAccount = user && user.soundcloud ? await soundcloud.getUser(user.soundcloud) : undefined;

      const message = createUserDetailsEmbed(context.user, spotifyAccount, soundCloudAccount, user && user.identifiers);
      await context.channel.sendEmbed(message);
    }
  }

  private async clearUserData(context: CommandContext): Promise<void> {
    const removed = await context.user.clearData();
    const response = removed ? 'Okay! I have erased my knowledge about you entirely.'
        : `I already don't know anything about you`;
    await context.message.reply(response);
  }

}

export const ACCOUNT_COMMAND: Command = {
  name: 'me',
  details: 'Show your account details. Including linked music accounts and identifiers',
  permission: PERMISSION.USER,
  category: ACCOUNT_CATEGORY,
  keywords: [KEYWORDS.CLEAR],
  usage: ['', 'clear'],
  createAction: services => new AccountAction(services)
};


