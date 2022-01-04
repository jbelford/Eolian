import { Command, CommandContext } from 'commands/@types';
import { GENERAL_CATEGORY } from 'commands/category';
import { UserPermission } from 'common/constants';
import { createInviteEmbed } from 'embed';

async function execute(context: CommandContext): Promise<void> {
  const inviteLink = context.client.generateInvite();
  const inviteEmbed = createInviteEmbed(inviteLink, context.client.name, context.client.pic);
  await context.interaction.sendEmbed(inviteEmbed, { ephemeral: false });
}

export const INVITE_COMMAND: Command = {
  name: 'invite',
  category: GENERAL_CATEGORY,
  details: 'Create a link to invite the bot to another server.',
  keywords: [],
  permission: UserPermission.User,
  dmAllowed: true,
  usage: [{ example: '' }],
  args: {
    base: true,
    groups: [],
  },
  execute,
};
