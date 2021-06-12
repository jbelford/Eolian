import { Command, CommandContext, CommandOptions, SyntaxType } from 'commands/@types';
import { SETTINGS_CATEGORY } from 'commands/category';
import { PERMISSION } from 'common/constants';
import { EolianUserError } from 'common/errors';
import { createServerDetailsEmbed } from 'embed';

const enum CONFIG_OPTION {
  PREFIX = 'prefix',
  VOLUME = 'volume',
  SYNTAX = 'syntax'
}

type ConfigSetFunc = (context: CommandContext, value: string) => Promise<void>;

const configSetMap = new Map<CONFIG_OPTION, ConfigSetFunc>([
  [CONFIG_OPTION.PREFIX, setPrefix],
  [CONFIG_OPTION.VOLUME, setVolume],
  [CONFIG_OPTION.SYNTAX, setSyntax]
]);

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  if (!options.ARG) {
    const server = await context.server!.details.get();
    const details = createServerDetailsEmbed(context.server!.details, server);
    await context.channel.sendEmbed(details);
    return;
  }

  if (options.ARG.length !== 2) {
    throw new EolianUserError('To set a config, I require two arguments: `<name> <value>`')
  }

  const name = options.ARG[0].toLowerCase();
  const value = options.ARG[1].toLowerCase();

  const setFn = configSetMap.get(name as CONFIG_OPTION);
  if (!setFn) {
    throw new EolianUserError(`There is no config for \`${name}\``);
  }

  await setFn(context, value);
}

async function setPrefix(context: CommandContext, prefix: string) {
  if (prefix.length !== 1) {
    throw new EolianUserError('Please specify a prefix that is only 1 character in length!');
  }

  await context.server?.details.setPrefix(prefix);
  await context.channel.send(`✨ The prefix is now \`${prefix}\`!`);
}

async function setVolume(context: CommandContext, volume: string) {
  let value = +volume;
  if (isNaN(value) || value < 0 || value > 100) {
    throw new EolianUserError('Volume must be a number between 0 and 100!');
  }

  value = value / 100;

  await context.server!.details.setVolume(value);
  await context.channel.send(`✨ The default volume is now \`${volume}%\`!`);

  if (!context.server!.player.isStreaming) {
    context.server!.player.setVolume(value);
  }
}

async function setSyntax(context: CommandContext, syntax: string) {
  let type: SyntaxType;
  switch (syntax.toLowerCase()) {
    case 'keyword':
      type = SyntaxType.KEYWORD;
      break;
    case 'traditional':
      type = SyntaxType.TRADITIONAL;
      break;
    default:
      throw new EolianUserError(`Unrecognized syntax type! Available types are 'keyword' or 'traditional'.`);
  }

  await context.server!.details.setSyntax(type);
  await context.channel.send(`✨ The server now uses \`${syntax}\` syntax!`);
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
    },
    {
      title: 'Set default volume config',
      example: 'volume 50'
    },
    {
      title: 'Set syntax preference to keyword based',
      example: 'syntax keyword'
    },
    {
      title: 'Set syntax preference to traditional',
      example: 'syntax traditional'
    }
  ],
  execute
};