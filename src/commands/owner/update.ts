import { OwnerCommand } from 'commands/@types';

export const UPDATE_SLASH_COMMAND: OwnerCommand = {
  name: 'updateCommands',
  numArgs: 0,
  async execute(context) {
    const success = await context.client.updateCommands();
    if (success) {
      await context.interaction.send('Request to update commands sent successfully!');
    } else {
      await context.interaction.send('I failed to update commands. Check the logs.');
    }
  },
};
