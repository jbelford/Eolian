import { PERMISSION } from "../../common/constants";
import { Embed } from "../../common/embed";
import { CommandAction, GeneralCategory } from "../command";


export const InviteCommand: Command = {
  name: 'invite',
  category: GeneralCategory,
  details: 'Create a link to invite the bot to another server',
  keywords: [],
  permission: PERMISSION.USER,
  usage: [''],
  createAction: (params) => new InviteAction(params)
};

class InviteAction extends CommandAction {

  public async execute({ message, bot }: CommandActionContext): Promise<void> {
    const inviteLink = await bot.generateInvite();
    const inviteEmbed = Embed.invite(inviteLink, bot.name, bot.pic);
    await message.sendEmbed(inviteEmbed);
  }

}