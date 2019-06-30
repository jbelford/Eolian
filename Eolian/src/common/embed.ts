import { COMMANDS } from "commands/index";
import environment from "environments/env";
import { COLOR } from './constants';

/**
 * This namespace describes functions for building embed messages
 */
export namespace Embed {

  export namespace Help {

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

    export function keywordDetails(keyword: Keyword): EmbedMessage {
      const embed: EmbedMessage = {
        color: COLOR.HELP,
        header: {
          text: `${keyword.priority ? 'Pattern' : 'Keyword'}: ${keyword.name}`
        },
        description: `${keyword.details}\n\n`,
      };
      embed.description += '**Example Usage:**\n```\n' + keyword.usage.map(example => `${example}`).join('\n') + '```';
      if (keyword.priority)
        embed.description += `\n_Note: Don't stare at this description too hard! Commands that use this pattern will show examples!_`;
      return embed;
    }

  }

  export function invite(link: string, username: string, pic: string): EmbedMessage {
    return {
      title: `**Invite: ${username}**`,
      description: 'Click to invite bot to server',
      url: link,
      thumbnail: pic,
      color: COLOR.INVITE
    }
  }

  export namespace Poll {

    export function question(question: string, options: PollOption[], username: string, pic: string): EmbedMessage {
      return {
        header: {
          text: '📣 Poll 📣'
        },
        title: `*${question}*`,
        color: COLOR.POLL,
        description: options.map(option => `${option.emoji}: ${option.text}`).join('\n\n'),
        footer: {
          text: `${username}'s poll`,
          icon: pic
        },
        buttons: Array.from(options) // This is to break the reference
      };
    }

    export function results(question: string, results: PollOptionResult[], username: string, pic: string): EmbedMessage {
      const description = results.sort((a, b) => b.count - a.count)
        .map(result => `**${result.option}**: ${result.count} Votes`);
      description[0] += ' ✅';

      return {
        header: {
          text: '📣 Poll Results 📣'
        },
        title: `*${question}*`,
        color: COLOR.POLL,
        description: description.join('\n'),
        footer: {
          text: `${username}'s poll`,
          icon: pic
        }
      };
    }

  }

  export function selection(question: string, options: string[]): EmbedMessage {
    return {
      header: {
        text: '👈🏻 Select one 👉🏻'
      },
      title: `*${question}*`,
      color: COLOR.SELECTION,
      description: options.map((option, i) => `${i + 1}: ${option}`).join('\n') + '\n0: Cancel',
      footer: {
        text: `Enter the number of your selection in chat`
      }
    };
  }

  export function userDetails(contextUser: ContextUser, spotify?: SpotifyUser, soundcloud?: SoundCloudUser,
    identifiers?: { [key: string]: Identifier }): EmbedMessage {

    let description = `**Spotify:** ${spotify ? spotify.external_urls.spotify : 'N/A'}\n`
      + `**SoundCloud:** ${soundcloud ? soundcloud.permalink_url : 'N/A'}\n`
      + `**Identifiers:** `;
    if (identifiers && Object.keys(identifiers).length > 0) {
      description += Object.keys(identifiers).map((key, i) => `[${key}](${identifiers[key].url})`).join(', ');
    } else {
      description += 'N/A';
    }

    return {
      header: {
        icon: contextUser.avatar,
        text: `🎫 Profile Details 🎫 `
      },
      title: `Here's what I know about you ${contextUser.name}!`,
      color: COLOR.PROFILE,
      description: description,
      footer: {
        text: `See 'help' for the 'Account' category to configure your profile.`
      }
    }
  }

}