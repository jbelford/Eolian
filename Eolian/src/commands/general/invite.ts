import { CommandAction, GeneralCategory } from "commands/command";
import { PERMISSION } from "common/constants";
import { Embed } from "common/embed";

class InviteAction extends CommandAction {

  public async execute({ channel }: CommandActionContext): Promise<void> {
    const inviteLink = await this.services.bot.generateInvite();
    const inviteEmbed = Embed.invite(inviteLink, this.services.bot.name, this.services.bot.pic);
    await channel.sendEmbed(inviteEmbed);
  }

}

export const InviteCommand: Command = {
  name: 'invite',
  category: GeneralCategory,
  details: 'Create a link to invite the bot to another server',
  keywords: [],
  permission: PERMISSION.USER,
  usage: [''],
  action: InviteAction
};