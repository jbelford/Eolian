import { GeneralCategory } from "commands/command";
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

  info = info;

  constructor(private readonly services: CommandActionServices) {}

  public async execute({ channel }: CommandActionContext): Promise<void> {
    const inviteLink = await this.services.bot.generateInvite();
    const inviteEmbed = Embed.invite(inviteLink, this.services.bot.name, this.services.bot.pic);
    await channel.sendEmbed(inviteEmbed);
  }

}

export const InviteCommand: Command = {
  info,
  action: InviteAction
};