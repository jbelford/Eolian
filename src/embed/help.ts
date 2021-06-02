import { COMMANDS } from 'commands';
import { Command, CommandCategory, Keyword, Pattern } from 'commands/@types';
import { COLOR, GITHUB_PAGE_WIKI, PERMISSION } from 'common/constants';
import { environment } from 'common/env';
import { EmbedMessage } from 'eolian/@types';

const helpFooter = `_Want to know more? [See the Wiki](${GITHUB_PAGE_WIKI})_`;

export function createCategoryListEmbed(categories: CommandCategory[], prefix = environment.cmdToken): EmbedMessage {
  const embed: EmbedMessage = {
    color: COLOR.HELP,
    title: 'Command Categories',
    description: 'The following are categories for the various commands available:\n\n',
    footer: {
      text: `You can activate commands by tagging me directly OR by placing a \`${prefix}\` symbol at the beginning of the message.`
    }
  }
  embed.description += '```\n' + categories.map((category, i) => `${i + 1}: ${category.name}`).join('\n') + '```'
    + `\nUse \`help help\` to see more details about using this command`
    + `\n\n${helpFooter}`
  return embed;
}

export function createCommandListEmbed(category: CommandCategory, permission: PERMISSION): EmbedMessage {
  const embed: EmbedMessage = {
    color: COLOR.HELP,
    header: {
      text: `📁  Category  📁`,
    },
    title: category.name,
    description: `${category.details}\n\n`
  };

  const commands = COMMANDS.filter(cmd => cmd.category.name === category.name)
    .filter(cmd => cmd.permission <= permission)
    .map(cmd => cmd.name);

  embed.description += `\`\`\`
${commands.join('\n')}
\`\`\`
Use \`help <command\` to see more information for that command.

${helpFooter}
`;

  return embed;
}

export function createCommandDetailsEmbed(command: Command): EmbedMessage {
  const embed: EmbedMessage = {
    color: COLOR.HELP,
    header: {
      text: `📁  Command  📁`
    },
    title: command.name,
    description: `${command.details}\n\n`,
    footer: {
      text: `Can be used in direct message? ${command.dmAllowed ? 'Yes': 'No' }`
    }
  };

  if (command.keywords?.length) {
    embed.description += '**Accepted Keywords**\n```\n'
      + command.keywords.map(keyword => keyword.name).join(' ') + '```\n';
  }
  if (command.patterns?.length) {
    embed.description += '**Accepted Patterns**\n```\n'
      + command.patterns.map(pattern => pattern.name).join(' ') + '```\n';
  }

  if (command.patterns?.length) {
    embed.description += 'Use `help <name of pattern or keyword>` to learn more about patterns and keywords. Most arguments are based on them!\n\n'
  }

  embed.description += helpFooter;

  embed.fields = command.usage.map(({ title, example }, idx) => ({ name: `Ex. ${idx + 1}${title ? `\t${title}` : ''}`, value: `\`\`\`\n${command.name} ${example}\n\`\`\``}));

  return embed;
}

export function createKeywordDetailsEmbed(keyword: Keyword): EmbedMessage {
  const embed: EmbedMessage = {
    color: COLOR.HELP,
    header: {
      text: `🚩  Keyword  🚩`
    },
    title: keyword.name,
    description: `${keyword.details}\n\n`
  };
  embed.description += '**Example Usage:**\n```\n' + keyword.name.toLowerCase() + '```';
  embed.description += `\n\n${helpFooter}`;
  return embed;
}

export function createPatternDetailsEmbed(keyword: Pattern<unknown>): EmbedMessage {
  const embed: EmbedMessage = {
    color: COLOR.HELP,
    header: {
      text: `🚩  Pattern  🚩`
    },
    title: keyword.name,
    description: `${keyword.details}\n\n`
  };
  embed.description += '**Example Usage:**\n```\n' + keyword.usage.map(example => `${example}`).join('\n') + '```';
  embed.description += `\n_Note: Don't stare at this description too hard! Commands that use this pattern will show examples!_`;
  embed.description += `\n\n${helpFooter}`;
  return embed;
}