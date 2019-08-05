import { GENERAL_CATEGORY } from "commands/category";
import { PERMISSION } from 'common/constants';
import * as embed from "embed";

const info: CommandInfo = {
  name: 'invite',
  category: GENERAL_CATEGORY,
  details: 'Create a link to invite the bot to another server',
  keywords: [],
  permission: PERMISSION.USER,
  usage: [''],
};

class InviteAction implements CommandAction {

  constructor(private readonly services: CommandActionServices) {}

  async execute({ channel }: CommandActionContext): Promise<void> {
    const inviteLink = await this.services.bot.generateInvite();
    const inviteEmbed = embed.invite(inviteLink, this.services.bot.name, this.services.bot.pic);
    await channel.sendEmbed(inviteEmbed);
  }

}

export const INVITE_COMMAND: Command = {
  info,
  createAction(services) {
    return new InviteAction(services);
  }
};