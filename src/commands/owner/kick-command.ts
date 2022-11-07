import { OwnerCommand } from '../@types';

export const KICK_COMMAND: OwnerCommand = {
  name: 'kick',
  numArgs: 1,
  async execute(context, [id]) {
    const kicked = await context.client.leave(id);
    await context.interaction.send(kicked ? `I have left ${id}` : `I don't recognize that guild!`);
  },
};
