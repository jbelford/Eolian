import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { GENERAL_CATEGORY } from '../category';
import { OWNER_COMMANDS } from '../owner';
import { CommandOptions } from '@eolian/command-options/@types';
import { CommandContext, Command } from '../@types';
import { PATTERNS } from '@eolian/command-options';

const PAGE_LENGTH = 10;

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  await context.interaction.defer();

  let servers = context.client.getServers().sort((a, b) => b.members - a.members);

  let start = 0;
  if (options.NUMBER && options.NUMBER[0] >= 0) {
    start = options.NUMBER[0] * PAGE_LENGTH;
  }

  if (start >= servers.length) {
    start = Math.max(0, servers.length - PAGE_LENGTH);
  }

  if (options.ARG && options.ARG.length > 0) {
    const name = options.ARG[0];
    if (name === 'sort') {
      const prop = options.ARG[1];
      // @ts-ignore
      if (servers.length && typeof servers[0][prop] === 'number') {
        // @ts-ignore
        servers = servers.sort((a, b) => b[prop] - a[prop]);
      }
    } else {
      const command = OWNER_COMMANDS.get(name);
      if (!command) {
        throw new EolianUserError(`There is no subcommand \`${name}\`!`);
      } else if (options.ARG.length - 1 !== command.numArgs) {
        throw new EolianUserError(`Command \`${name}\` requires ${command.numArgs} arguments!`);
      }
      await command.execute(context, options.ARG.slice(1));
      return;
    }
  }

  const members = servers.reduce((sum, server) => sum + server.members, 0);
  const recentlyUsed = context.client.getRecentlyUsedCount();
  let response =
    `Total Servers: ${servers.length}\nTotal Users: ${members}\nActive Servers: ${recentlyUsed}` +
    '```';
  response += servers
    .slice(start, start + PAGE_LENGTH)
    .map((server, i) => `${start + i + 1}. ${JSON.stringify(server)}`)
    .join('\n');
  response += '\n```';

  await context.interaction.send(response);
}

export const SERVERS_COMMAND: Command = {
  name: 'servers',
  shortName: 'sv',
  details: 'Show all servers this bot is joined to.',
  permission: UserPermission.Owner,
  category: GENERAL_CATEGORY,
  patterns: [PATTERNS.NUMBER, PATTERNS.ARG],
  dmAllowed: true,
  usage: [
    {
      title: 'Show servers',
      example: '',
    },
    {
      title: 'Show servers at page',
      example: [PATTERNS.NUMBER.ex('2')],
    },
    {
      title: 'Sort by bot',
      example: [PATTERNS.ARG.ex('sort', 'botCount')],
    },
    {
      title: 'Kick server',
      example: [PATTERNS.ARG.ex('kick', '<id>')],
    },
  ],
  args: {
    base: true,
    groups: [
      {
        required: false,
        options: [
          {
            name: 'action',
            details: 'The custom action to do',
            getChoices() {
              return ['sort'].concat(...OWNER_COMMANDS.keys());
            },
          },
        ],
      },
      {
        required: false,
        options: [
          {
            name: 'arg',
            details: 'Argument for the action',
          },
        ],
      },
    ],
  },
  execute,
};
