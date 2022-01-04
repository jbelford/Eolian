import { CommandContext, OwnerCommand } from 'commands/@types';
import { EolianUserError } from 'common/errors';

export const KICK_COMMAND: OwnerCommand = {
  name: 'kick',
  numArgs: 1,
  async execute(context, [id]) {
    const kicked = await context.client.leave(id);
    await context.interaction.send(kicked ? `I have left ${id}` : `I don't recognize that guild!`);
  },
};

async function kickOld(context: CommandContext, [id]: string[]): Promise<void> {
  const days = +id;
  if (isNaN(days)) {
    throw new EolianUserError('Must provide a number for days!');
  }

  const minDate = new Date(Date.now() - (1000 * 60 * 60 * 24 * days));
  const servers = await context.client.getIdleServers(minDate);
  if (servers.length === 0) {
    throw new EolianUserError('No servers!');
  }
  await context.interaction.send(
    servers.map((s, i) => `${i}. ${s._id} ${s.lastUsage?.toUTCString() ?? ''}`).join('\n')
  );
  const result = await context.interaction.sendSelection(
    'Kick?',
    [{ name: 'Yes' }, { name: 'No' }],
    context.interaction.user
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

async function kickUnused(context: CommandContext): Promise<void> {
  const servers = await context.client.getUnusedServers();
  if (servers.length === 0) {
    throw new EolianUserError('No servers!');
  }
  await context.interaction.send(servers.map((s, i) => `${i}. ${s.id}`).join('\n'));
  const result = await context.interaction.sendSelection(
    'Kick?',
    [{ name: 'Yes' }, { name: 'No' }],
    context.interaction.user
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
