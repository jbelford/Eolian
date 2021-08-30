import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { GENERAL_CATEGORY } from 'commands/category';
import { PATTERNS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';

const PAGE_LENGTH = 20;

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  const servers = context.client.getServers();

  let start = 0;
  if (options.NUMBER && options.NUMBER >= 0) {
    start = options.NUMBER * PAGE_LENGTH;
  }

  if (start >= servers.length) {
    start = Math.max(0, servers.length - PAGE_LENGTH);
  }

  let response = `Total Servers: ${servers.length}\n` + '```'
  response += servers.slice(start, start + PAGE_LENGTH).map((server, i) => `${start + i + 1}. ${JSON.stringify(server)}`).join('\n');
  response += '\n```';

  await context.channel.send(response);
}

export const SERVERS_COMMAND: Command = {
  name: 'servers',
  details: 'Show all servers this bot is joined to',
  permission: PERMISSION.OWNER,
  category: GENERAL_CATEGORY,
  patterns: [PATTERNS.NUMBER],
  dmAllowed: true,
  usage: [
    {
      title: 'Show servers',
      example: ''
    },
    {
      title: 'Show servers at page',
      example: '2'
    }
  ],
  execute
}