import { COMMANDS } from 'commands';
import { Command, CommandCategory, Keyword, Pattern, SyntaxType } from 'commands/@types';
import { COLOR, GITHUB_PAGE_WIKI, PERMISSION } from 'common/constants';
import { environment } from 'common/env';
import { EmbedMessage } from 'framework/@types';

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
    .filter(cmd => cmd.permission < PERMISSION.ADMIN || cmd.permission <= permission)
    .map(cmd => cmd.new ? `${cmd.name} *NEW*` : cmd.name);

  embed.description += `\`\`\`
${commands.join('\n')}
\`\`\`
Use \`help <command\` to see more information for that command.

${helpFooter}
`;

  return embed;
}

function getRequiresDjState(permission: PERMISSION) {
  switch (permission) {
    case PERMISSION.DJ:
      return 'Yes';
    case PERMISSION.DJ_LIMITED:
      return 'Limited';
    default:
      return 'No';
  }
}

export function createCommandDetailsEmbed(command: Command, type = SyntaxType.KEYWORD): EmbedMessage {
  const embed: EmbedMessage = {
    color: COLOR.HELP,
    header: {
      text: `📁  Command  📁`
    },
    title: command.name,
    description: `${command.details}\n\n`,
    footer: {
      text: `Can be used in direct message? ${command.dmAllowed ? 'Yes': 'No' }\nRequires DJ Role? ${getRequiresDjState(command.permission)}`
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

  embed.fields = command.usage.map(({ title, example }, idx) => ({
    name: `Ex. ${idx + 1}${title ? `\t${title}` : ''}`,
    value: `\`\`\`\n${command.name} ${typeof example === 'string' ? example : example.map(ex => ex.text(type)).join(' ')}\n\`\`\``
  }));

  return embed;
}

export function createKeywordDetailsEmbed(keyword: Keyword, type = SyntaxType.KEYWORD): EmbedMessage {
  const embed: EmbedMessage = {
    color: COLOR.HELP,
    header: {
      text: `🚩  Keyword  🚩`
    },
    title: keyword.name,
    description: `${keyword.details}\n\n`,
    footer: {
      text: `Requires DJ Role? ${getRequiresDjState(keyword.permission)}`
    }
  };
  embed.description += '**Example Usage:**\n```\n' + keyword.text(type) + '```';
  embed.description += `\n\n${helpFooter}`;
  return embed;
}

export function createPatternDetailsEmbed(pattern: Pattern<unknown>, type = SyntaxType.KEYWORD): EmbedMessage {
  const embed: EmbedMessage = {
    color: COLOR.HELP,
    header: {
      text: `🚩  Pattern  🚩`
    },
    title: pattern.name,
    description: `${pattern.details}\n\n`,
    footer: {
      text: `Requires DJ Role? ${getRequiresDjState(pattern.permission)}`
    }
  };
  embed.description += '**Example Usage:**\n```\n' + pattern.usage.map(example => pattern.ex(example).text(type)).join('\n') + '```';
  embed.description += `\n_Note: Don't stare at this description too hard! Commands that use this pattern will show examples!_`;
  embed.description += `\n\n${helpFooter}`;
  return embed;
}