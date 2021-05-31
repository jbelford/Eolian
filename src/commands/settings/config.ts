import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { SETTINGS_CATEGORY } from 'commands/category';
import { PERMISSION } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { createServerDetailsEmbed } from 'embed';
import { ServerDetails } from 'eolian/@types';

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  if (!options.ARG) {
    const server = await context.server!.details.get();
    const details = createServerDetailsEmbed(context.server!.details, server.prefix);
    await context.channel.sendEmbed(details);
    return;
  }

  if (options.ARG.length !== 2) {
    throw new EolianUserError('To set a config, I require two arguments: `<name> <value>`')
  }

  const name = options.ARG[0].toLowerCase();
  const value = options.ARG[1].toLowerCase();

  switch (name) {
    case 'prefix':
      await setPrefix(context.server!.details, value);
      await context.channel.send(`✨ The prefix is now \`${value}\`!`);
      break;
    default:
      throw new EolianUserError(`There is no config for \`${name}\``);
  }
}

async function setPrefix(server: ServerDetails, prefix: string) {
  if (prefix.length !== 1) {
    throw new EolianUserError('Please specify a prefix that is only 1 character in length!');
  }

  await server.setPrefix(prefix);
}

export const CONFIG_COMMAND: Command = {
  name: 'config',
  details: 'Show configuration or change configurations for server',
  category: SETTINGS_CATEGORY,
  permission: PERMISSION.ADMIN,
  usage: [
    {
      title: 'Show server configs',
      example: '',
    },
    {
      title: 'Set prefix config',
      example: 'prefix $'
    }
  ],
  execute
};