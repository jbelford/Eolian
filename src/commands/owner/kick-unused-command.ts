import { EolianUserError } from '@eolian/common/errors';
import { CommandContext, OwnerCommand } from '../@types';

async function kickUnused(context: CommandContext): Promise<void> {
  const servers = await context.client.getUnusedServers();
  if (servers.length === 0) {
    throw new EolianUserError('No servers!');
  }
  await context.interaction.send(servers.map((s, i) => `${i}. ${s.id}`).join('\n'));
  const result = await context.interaction.sendSelection(
    'Kick?',
    [{ name: 'Yes' }, { name: 'No' }],
    context.interaction.user,
  );
  if (result.selected === 0) {
    await Promise.all(servers.map(s => context.client.leave(s.id)));
    await result.message.edit(`I have left all ${servers.length} servers`);
  } else {
    await result.message.edit(`Cancelled kick`);
  }
}

export const KICK_UNUSED_COMMAND: OwnerCommand = {
  name: 'kickUnused',
  numArgs: 0,
  execute: kickUnused,
};
