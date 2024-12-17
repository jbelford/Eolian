import { SyntaxType, Keyword, Pattern } from '@eolian/command-options/@types';
import { COMMANDS } from '@eolian/commands';
import { CommandCategory, Command } from '@eolian/commands/@types';
import { GITHUB_PAGE_WIKI, Color, UserPermission } from '@eolian/common/constants';
import { environment } from '@eolian/common/env';
import { EmbedMessage } from '@eolian/framework/@types';

const helpFooter = `_Want to know more? [See the Wiki](${GITHUB_PAGE_WIKI})_`;

export function createCategoryListEmbed(
  categories: CommandCategory[],
  prefix = environment.cmdToken,
): EmbedMessage {
  const embed: EmbedMessage = {
    color: Color.Help,
    title: 'Command Categories',
    description: 'The following are categories for the various commands available:\n\n',
    footer: {
      text: `You can activate commands by tagging me directly OR by placing a \`${prefix}\` symbol at the beginning of the message.`,
    },
  };
  embed.description +=
    '```\n' +
    categories.map((category, i) => `${i + 1}: ${category.name}`).join('\n') +
    '```' +
    `\nUse \`help help\` to see more details about using this command` +
    `\n\n${helpFooter}`;
  return embed;
}

export function createCommandListEmbed(
  category: CommandCategory,
  permission: UserPermission,
): EmbedMessage {
  const embed: EmbedMessage = {
    color: Color.Help,
    header: {
      text: `📁  Category  📁`,
    },
    title: category.name,
    description: `${category.details}\n\n`,
  };

  const commands = COMMANDS.list
    .filter(cmd => cmd.category.name === category.name)
    .filter(cmd => cmd.permission < UserPermission.Admin || cmd.permission <= permission)
    .map(cmd => (cmd.new ? `${cmd.name} *NEW*` : cmd.name));

  embed.description += `\`\`\`
${commands.join('\n')}
\`\`\`
Use \`help <command\` to see more information for that command.

${helpFooter}
`;

  return embed;
}

function getRequiresDjState(permission: UserPermission) {
  switch (permission) {
    case UserPermission.DJ:
      return 'Yes';
    case UserPermission.DJLimited:
      return 'Limited';
    default:
      return 'No';
  }
}

export function createCommandDetailsEmbed(
  command: Command,
  type = SyntaxType.KEYWORD,
): EmbedMessage {
  const embed: EmbedMessage = {
    color: Color.Help,
    header: {
      text: `📁  Command  📁`,
    },
    title: command.name,
    description: `${command.details}\n\n`,
    footer: {
      text: `Can be used in direct message? ${
        command.dmAllowed ? 'Yes' : 'No'
      }\nRequires DJ Role? ${getRequiresDjState(command.permission)}`,
    },
  };

  embed.description += `**Usage**\n\`\`\`\n${command.name}\n`;
  if (command.shortName) {
    embed.description += `${command.shortName}\n`;
  }
  embed.description += '```\n';

  if (command.keywords?.length) {
    embed.description +=
      '**Accepted Keywords**\n```\n' +
      command.keywords.map(keyword => keyword.name).join(' ') +
      '```\n';
  }
  if (command.patterns?.length) {
    embed.description +=
      '**Accepted Patterns**\n```\n' +
      command.patterns.map(pattern => pattern.name).join(' ') +
      '```\n';
  }

  if (command.patterns?.length) {
    embed.description +=
      'Use `help <name of pattern or keyword>` to learn more about patterns and keywords. Most arguments are based on them!\n\n';
  }

  embed.description += helpFooter;

  const slash = type === SyntaxType.SLASH ? '/' : '';
  embed.fields = command.usage
    .filter(item => !item.hide)
    .map(({ title, example }, idx) => {
      const mapped =
        typeof example === 'string' ? example : example.map(ex => ex.text(type)).join(' ');
      return {
        name: `Ex. ${idx + 1}${title ? `\t${title}` : ''}`,
        value: `\`\`\`\n${slash}${command.name} ${mapped}\n\`\`\``,
      };
    });

  return embed;
}

export function createKeywordDetailsEmbed(
  keyword: Keyword,
  type = SyntaxType.KEYWORD,
): EmbedMessage {
  const embed: EmbedMessage = {
    color: Color.Help,
    header: {
      text: `🚩  Keyword  🚩`,
    },
    title: keyword.name,
    description: `${keyword.details}\n\n`,
    footer: {
      text: `Requires DJ Role? ${getRequiresDjState(keyword.permission)}`,
    },
  };
  embed.description += '**Example Usage:**\n```\n' + keyword.text(type);
  if (keyword.shortName && type === SyntaxType.TRADITIONAL) {
    embed.description += `\n${keyword.text(type, true)}`;
  }
  embed.description += `\`\`\`\n${helpFooter}`;
  return embed;
}

export function createPatternDetailsEmbed(
  pattern: Pattern,
  type = SyntaxType.KEYWORD,
): EmbedMessage {
  const embed: EmbedMessage = {
    color: Color.Help,
    header: {
      text: `🚩  Pattern  🚩`,
    },
    title: pattern.name,
    description: `${pattern.details}\n\n`,
    footer: {
      text: `Requires DJ Role? ${getRequiresDjState(pattern.permission)}`,
    },
  };
  embed.description +=
    '**Example Usage:**\n```\n' +
    pattern.usage
      .map(example => pattern.ex(...(typeof example === 'string' ? [example] : example)).text(type))
      .join('\n') +
    '```';
  embed.description += `\n_Note: Don't stare at this description too hard! Commands that use this pattern will show examples!_`;
  embed.description += `\n\n${helpFooter}`;
  return embed;
}
