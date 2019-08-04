import { GeneralCategory } from "commands/category";
import { PERMISSION } from 'common/constants';
import { Embed } from "common/embed";

const info: CommandInfo = {
  name: 'invite',
  category: GeneralCategory,
  details: 'Create a link to invite the bot to another server',
  keywords: [],
  permission: PERMISSION.USER,
  usage: [''],
};

class InviteAction implements CommandAction {

  constructor(private readonly services: CommandActionServices) {}

  public async execute({ channel }: CommandActionContext): Promise<void> {
    const inviteLink = await this.services.bot.generateInvite();
    const inviteEmbed = Embed.invite(inviteLink, this.services.bot.name, this.services.bot.pic);
    await channel.sendEmbed(inviteEmbed);
  }

}

export const InviteCommand: Command = {
  info,
  createAction(services) {
    return new InviteAction(services);
  }
};