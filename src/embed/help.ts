import { COMMANDS } from 'commands';
import { COLOR } from 'common/constants';
import { environment } from 'common/env';

export function categoryList(categories: CommandCategory[]): EmbedMessage {
  const embed: EmbedMessage = {
    color: COLOR.HELP,
    header: {
      text: 'Command Category List',
    },
    description: 'The following are categories for the various commands available:\n\n',
    footer: {
      text: `You can activate commands by tagging me directly OR by placing a \`${environment.cmdToken}\` symbol at the beginning of the message.`
    }
  }
  embed.description += '```\n' + categories.map((category, i) => `${i + 1}: ${category.name}`).join('\n') + '```'
    + `\nUse \`help /help/\` to see more details about using this command`
  return embed;
}

export function commandList(category: CommandCategory): EmbedMessage {
  const embed: EmbedMessage = {
    color: COLOR.HELP,
    header: {
      text: `Category: ${category.name}`,
    },
    description: `${category.details}\n\n`,
  };
  embed.description += '```\n'
    + COMMANDS.filter(cmd => cmd.info.category.name === category.name).map(cmd => cmd.info.name).join('\n')
    + '```' + `\nUse \`help /<command>/\` to see more information for that command.`
  return embed;
}

export function commandDetails(info: CommandInfo): EmbedMessage {
  const embed: EmbedMessage = {
    color: COLOR.HELP,
    header: {
      text: `Command: ${info.name}`
    },
    description: `${info.details}\n\n`
  };
  const keywords = info.keywords.filter(keyword => !keyword.priority);
  const complexKeywords = info.keywords.filter(keywords => keywords.priority);
  if (keywords.length) {
    embed.description += '**Keywords:** These are keywords which don\'t take inputs.\n```\n'
      + keywords.map(keyword => keyword.name).join('\n') + '```\n';
  }
  if (complexKeywords.length) {
    embed.description += '**Patterns:** Special patterns for taking inputs.\n```\n'
      + complexKeywords.map(keyword => keyword.name).join('\n') + '```\n';
  }
  embed.description += 'Use `help /<name of pattern or keyword>/` to learn more about patterns and keywords. All arguments are based on them!\n\n'
  embed.description += '**Example Usage:**\n```\n' + info.usage.map(example => `${info.name} ${example}`).join('\n') + '```';
  return embed;
}

export function keywordDetails(keyword: Keyword<unknown>): EmbedMessage {
  const embed: EmbedMessage = {
    color: COLOR.HELP,
    header: {
      text: `${keyword.priority ? 'Pattern' : 'Keyword'}: ${keyword.name}`
    },
    description: `${keyword.details}\n\n`,
  };
  embed.description += '**Example Usage:**\n```\n' + keyword.usage.map(example => `${example}`).join('\n') + '```';
  if (keyword.priority) {
    embed.description += `\n_Note: Don't stare at this description too hard! Commands that use this pattern will show examples!_`;
  }
  return embed;
}
