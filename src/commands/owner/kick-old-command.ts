import { EolianUserError } from '@eolian/common/errors';
import { CommandContext, OwnerCommand } from '../@types';

async function kickOld(context: CommandContext, [id]: string[]): Promise<void> {
  const days = +id;
  if (isNaN(days)) {
    throw new EolianUserError('Must provide a number for days!');
  }

  const minDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * days);
  const servers = await context.client.getIdleServers(minDate);
  if (servers.length === 0) {
    throw new EolianUserError('No servers!');
  }
  await context.interaction.send(
    servers.map((s, i) => `${i}. ${s._id} ${s.lastUsage?.toUTCString() ?? ''}`).join('\n'),
  );
  const result = await context.interaction.sendSelection(
    'Kick?',
    [{ name: 'Yes' }, { name: 'No' }],
    context.interaction.user,
  );
  if (result.selected === 0) {
    await Promise.all(servers.map(s => context.client.leave(s._id)));
    await result.message.edit(`I have left all ${servers.length} servers`);
  } else {
    await result.message.edit(`Cancelled kick`);
  }
}

export const KICK_OLD_COMMAND: OwnerCommand = {
  name: 'kickOld',
  numArgs: 1,
  execute: kickOld,
};
