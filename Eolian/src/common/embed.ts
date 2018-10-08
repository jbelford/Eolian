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
        + `\nUse \`${environment.cmdToken} help {help}\` to see more details about using this command`
      return embed;
    }

  }

}