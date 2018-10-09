import { COMMANDS } from "../commands/index";
import environment from "../environments/env";

/**
 * This namespace describes functions for building embed messages
 */
export namespace Embed {

  export namespace Help {

    export function categoryList(categories: CommandCategory[]): EmbedMessage {
      const embed: EmbedMessage = {
        color: 0x5A54B8,
        header: {
          text: 'Command Category List',
        },
        description: 'The following are categories for the various commands available:\n\n',
      }
      embed.description += '```' + categories.map((category, i) => `${i + 1}: ${category.name}`).join('\n') + '```'
        + `\nUse \`help {help}\` to see more details about using this command`
      return embed;
    }

    export function commandList(category: CommandCategory): EmbedMessage {
      const embed: EmbedMessage = {
        color: 0x5A54B8,
        header: {
          text: `Category: ${category.name}`,
        },
        description: `${category.details}\n\n`,
      };
      embed.description += '```'
        + COMMANDS.filter(cmd => cmd.category.name === category.name).map(cmd => `${environment.cmdToken} ${cmd.name}`).join('\n')
        + '```' + `\nUse \`help {<command>}\` to see more information for that command.`
      return embed;
    }

    export function commandDetails(command: Command): EmbedMessage {
      const embed: EmbedMessage = {
        color: 0x5A54B8,
        header: {
          text: `Command: ${command.name}`
        },
        description: `${command.details}\n\n`
      };
      const keywords = command.keywords.filter(keyword => !keyword.complex);
      const complexKeywords = command.keywords.filter(keywords => keywords.complex);
      if (keywords.length) {
        embed.description += '**Keywords:** These are keywords which don\'t take inputs.\n```'
          + keywords.map(keyword => keyword.name).join('\n') + '```\n';
      }
      if (complexKeywords.length) {
        embed.description += '**Argument Patterns:** Special patterns for taking inputs.\n```'
          + complexKeywords.map(keyword => keyword.name).join('\n') + '```\n';
      }
      embed.description += 'Use `help {<keyword / pattern>}` to learn more about patterns and keywords. All arguments are based on them!\n\n'
      embed.description += '**Example Usage:**\n```' + command.usage.map(example => `${command.name} ${example}`).join('\n') + '```';
      return embed;
    }

    export function keywordDetails(keyword: Keyword): EmbedMessage {
      const embed: EmbedMessage = {
        color: 0x5A54B8,
        header: {
          text: `${keyword.complex ? 'Argument Pattern' : 'Keyword'}: ${keyword.name}`
        },
        description: `${keyword.details}\n\n`,
      };
      embed.description += '**Example Usage:**\n```' + keyword.usage.map(example => `${example}`).join('\n') + '```';
      if (keyword.complex)
        embed.description += `\n_Note: Don't stare at this description too hard! Commands that use this pattern will show examples!_`;
      return embed;
    }

  }

}