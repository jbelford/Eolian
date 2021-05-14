import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { GENERAL_CATEGORY } from 'commands/category';
import { PERMISSION } from 'common/constants';

const PAGE_LENGTH = 20;

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  const servers = context.client.getServers();

  let start = 0;
  if (options.ARG) {
    const newPage = +options.ARG;
    if (!isNaN(newPage) && newPage >= 0) {
      start = newPage * PAGE_LENGTH;
    }
  }

  if (start >= servers.length) {
    start = Math.max(0, servers.length - PAGE_LENGTH);
  }

  let response = '```'
  response += servers.slice(start, start + PAGE_LENGTH).map((server, i) => `${start + i + 1}. ${JSON.stringify(server)}`).join('\n');
  response += '\n```';

  await context.channel.send(response);
}

export const SERVERS_COMMAND: Command = {
  name: 'servers',
  details: 'Show all servers this bot is joined to',
  permission: PERMISSION.OWNER,
  category: GENERAL_CATEGORY,
  dmAllowed: true,
  usage: ['', '1', '2'],
  execute
}