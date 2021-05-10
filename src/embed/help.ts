import { COMMANDS } from 'commands';
import { Command, CommandCategory, Keyword } from 'commands/@types';
import { COLOR } from 'common/constants';
import { environment } from 'common/env';
import { EmbedMessage } from 'eolian/@types';

export function createCategoryListEmbed(categories: CommandCategory[]): EmbedMessage {
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
    + `\nUse \`help help\` to see more details about using this command`
  return embed;
}

export function createCommandListEmbed(category: CommandCategory): EmbedMessage {
  const embed: EmbedMessage = {
    color: COLOR.HELP,
    header: {
      text: `Category: ${category.name}`,
    },
    description: `${category.details}\n\n`,
  };
  embed.description += '```\n'
    + COMMANDS.filter(cmd => cmd.category.name === category.name).map(cmd => cmd.name).join('\n')
    + '```' + `\nUse \`help <command>\` to see more information for that command.`
  return embed;
}

export function createCommandDetailsEmbed(command: Command): EmbedMessage {
  const embed: EmbedMessage = {
    color: COLOR.HELP,
    header: {
      text: `Command: ${command.name}`
    },
    description: `${command.details}\n\n`
  };

  if (command.keywords) {
    const keywords = command.keywords.filter(keyword => !keyword.priority);
    const complexKeywords = command.keywords.filter(keywords => keywords.priority);
    if (keywords.length) {
      embed.description += '**Keywords:** These are keywords which don\'t take inputs.\n```\n'
        + keywords.map(keyword => keyword.name).join('\n') + '```\n';
    }
    if (complexKeywords.length) {
      embed.description += '**Patterns:** Special patterns for taking inputs.\n```\n'
        + complexKeywords.map(keyword => keyword.name).join('\n') + '```\n';
    }
  }

  embed.description += 'Use `help <name of pattern or keyword>` to learn more about patterns and keywords. Most arguments are based on them!\n\n'
  embed.description += '**Example Usage:**\n```\n' + command.usage.map(example => `${command.name} ${example}`).join('\n') + '```';

  return embed;
}

export function createKeywordDetailsEmbed(keyword: Keyword<unknown>): EmbedMessage {
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
