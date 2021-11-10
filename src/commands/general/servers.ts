import { Command, CommandContext, CommandOptions } from 'commands/@types';
import { GENERAL_CATEGORY } from 'commands/category';
import { PATTERNS } from 'commands/keywords';
import { PERMISSION } from 'common/constants';

const PAGE_LENGTH = 10;


async function kickOld(days: number, context: CommandContext) {
  const minDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * days);
  const servers = await context.client.getIdleServers(minDate);
  if (servers.length === 0) {
    await context.channel.send('No servers!');
    return;
  }
  await context.channel.send(servers.map((s, i) => `${i}. ${s._id} ${s.lastUsage?.toUTCString() ?? ''}`).join('\n'));
  const idx = await context.channel.sendSelection('Kick?', [{ name: 'Yes' }, { name: 'No' }], context.user);
  if (idx === 0) {
    await Promise.all(servers.map(s => context.client.leave(s._id)));
    await context.channel.send(`I have left all ${servers.length} servers`);
  } else {
    await context.channel.send(`Cancelled kick`);
  }
}

async function execute(context: CommandContext, options: CommandOptions): Promise<void> {
  let servers = context.client.getServers().sort((a, b) => b.members - a.members);

  let start = 0;
  if (options.NUMBER && options.NUMBER[0] >= 0) {
    start = options.NUMBER[0] * PAGE_LENGTH;
  }

  if (start >= servers.length) {
    start = Math.max(0, servers.length - PAGE_LENGTH);
  }

  if (options.ARG && options.ARG.length > 1) {
    switch (options.ARG[0]) {
      case 'sort': {
        const prop = options.ARG[1];
        // @ts-ignore
        if (servers.length && typeof servers[0][prop] === 'number') {
          // @ts-ignore
          servers = servers.sort((a, b) => b[prop] - a[prop]);
        }
        break;
      }
      case 'kick': {
        const id = options.ARG[1];
        const kicked = await context.client.leave(id);
        await context.channel.send(kicked ? `I have left ${id}` : `I don't recognize that guild!`);
        return;
      }
      case 'kickOld': {
        const days = +options.ARG[1];
        if (!isNaN(days)) {
          await kickOld(days, context);
          return;
        }
      }
      default:
    }
  }

  const members = servers.reduce((sum, server) => sum + server.members, 0);
  let response = `Total Servers: ${servers.length}\nTotal Users: ${members}\n` + '```'
  response += servers.slice(start, start + PAGE_LENGTH).map((server, i) => `${start + i + 1}. ${JSON.stringify(server)}`).join('\n');
  response += '\n```';

  await context.channel.send(response);
}

export const SERVERS_COMMAND: Command = {
  name: 'servers',
  details: 'Show all servers this bot is joined to',
  permission: PERMISSION.OWNER,
  category: GENERAL_CATEGORY,
  patterns: [PATTERNS.NUMBER, PATTERNS.ARG],
  dmAllowed: true,
  usage: [
    {
      title: 'Show servers',
      example: ''
    },
    {
      title: 'Show servers at page',
      example: '2'
    },
    {
      title: 'Sort by bot',
      example: [PATTERNS.ARG.ex('/sort/botCount/')]
    },
    {
      title: 'Kick server',
      example: [PATTERNS.ARG.ex('/kick/<id>/')]
    }
  ],
  execute
}
