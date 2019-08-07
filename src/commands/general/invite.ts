import { BotServices, Command, CommandAction, CommandContext } from 'commands/@types';
import { GENERAL_CATEGORY } from 'commands/category';
import { PERMISSION } from 'common/constants';
import { createInviteEmbed } from 'embed';

class InviteAction implements CommandAction {

  constructor(private readonly services: BotServices) {}

  async execute({ channel }: CommandContext): Promise<void> {
    const inviteLink = await this.services.client.generateInvite();
    const inviteEmbed = createInviteEmbed(inviteLink, this.services.client.name, this.services.client.pic);
    await channel.sendEmbed(inviteEmbed);
  }

}

export const INVITE_COMMAND: Command = {
  name: 'invite',
  category: GENERAL_CATEGORY,
  details: 'Create a link to invite the bot to another server',
  keywords: [],
  permission: PERMISSION.USER,
  usage: [''],
  createAction: services => new InviteAction(services)
};