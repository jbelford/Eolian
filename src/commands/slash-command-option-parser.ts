import { CommandOptionBuilder, KEYWORDS, PATTERNS } from '@eolian/command-options';
import { CommandOptions, SyntaxType, Keyword, Pattern } from '@eolian/command-options/@types';
import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { Command, ICommandOptionProvider } from './@types';

export class SlashCommandOptionParser {
  constructor(
    private readonly command: Command,
    private readonly optionProvider: ICommandOptionProvider,
    private readonly permission: UserPermission,
  ) {}

  resolve(): CommandOptions {
    let options: CommandOptions;
    if (this.command.keywords || this.command.patterns) {
      options = this.parseCommandOptions();
    } else if (this.command.args) {
      options = this.parseCommandArgs();
    } else {
      options = this.getSimpleArgs();
    }
    return options;
  }

  private parseCommandOptions() {
    const builder = new CommandOptionBuilder(this.permission, SyntaxType.SLASH);
    const groupSet = new Set<string>();

    this.command.keywords
      ?.map(keyword => this.getKeyword(keyword, groupSet))
      .forEach(keyword => keyword && builder.withKeyword(keyword));

    this.parseGroupPatterns(builder);

    this.command.patternsUngrouped?.forEach(pattern => this.parseSlashPattern(builder, pattern));

    return builder.get();
  }

  private parseCommandArgs(): CommandOptions {
    const args = [];
    for (const group of this.command.args?.groups ?? []) {
      let selectedName: string | undefined;
      let selected: string | undefined;
      for (const option of group.options) {
        const value = this.optionProvider.getString(option.name) ?? undefined;
        if (value) {
          if (selected) {
            throw new EolianUserError(`You can not specify both ${selectedName} & ${option.name}`);
          }
          selectedName = option.name;
          selected = value;
        }
      }
      if (selected) {
        args.push(selected);
      } else if (group.required) {
        throw new EolianUserError(
          `You must provide ${group.options.map(o => `\`${o.name}\``).join(' or ')}`,
        );
      }
    }
    return { ARG: args };
  }

  private getSimpleArgs(): CommandOptions {
    const builder = new CommandOptionBuilder(this.permission, SyntaxType.SLASH);
    builder.withTextArgs(this.optionProvider.getString('args') ?? '');
    return builder.get();
  }

  private getKeyword(keyword: Keyword, groupSet: Set<string>) {
    let found: Keyword | undefined;
    if (keyword.group) {
      if (!groupSet.has(keyword.group)) {
        const value = this.optionProvider.getString(keyword.group) ?? '';
        found = KEYWORDS[value.toUpperCase()];
        groupSet.add(keyword.group);
      }
    } else if (this.optionProvider.getBoolean(keyword.name.toLowerCase())) {
      found = keyword;
    }
    return found;
  }

  private parseSlashPattern(builder: CommandOptionBuilder, pattern: Pattern) {
    if (this.command.args && pattern.name === PATTERNS.ARG.name) {
      const { ARG } = this.parseCommandArgs();
      builder.withArgs(ARG!);
    } else {
      const text = this.optionProvider.getString(pattern.name.toLowerCase());
      if (text) {
        builder.withPattern(pattern, text, true);
      }
    }
  }

  private parseGroupPatterns(builder: CommandOptionBuilder) {
    this.command.patternsGrouped?.forEach((patterns, group) => {
      const text = this.optionProvider.getString(group);
      if (text) {
        builder.withPatterns(patterns, text);
      }
    });
  }
}
