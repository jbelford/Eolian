import { describe, expect, it } from 'vitest';
import { KEYWORDS, PATTERNS } from '@eolian/command-options';
import { SyntaxType } from '@eolian/command-options/@types';
import { Command } from '@eolian/commands/@types';
import { GENERAL_CATEGORY, SETTINGS_CATEGORY } from '@eolian/commands/category';
import { Color, GITHUB_PAGE_WIKI, UserPermission } from '@eolian/common/constants';
import {
  createCategoryListEmbed,
  createCommandDetailsEmbed,
  createCommandListEmbed,
  createKeywordDetailsEmbed,
  createPatternDetailsEmbed,
} from '@eolian/embed/help-embed';

describe('help embed builders', () => {
  it('builds a numbered category list with the configured prefix', () => {
    const embed = createCategoryListEmbed([GENERAL_CATEGORY, SETTINGS_CATEGORY], '?');

    expect(embed).toMatchObject({
      color: Color.Help,
      title: 'Command Categories',
      footer: {
        text: 'You can activate commands by tagging me directly OR by placing a `?` symbol at the beginning of the message.',
      },
    });
    expect(embed.description).toContain('```\n1: General\n2: Settings```');
    expect(embed.description).toContain('Use `help help`');
    expect(embed.description).toContain(`[See the Wiki](${GITHUB_PAGE_WIKI})`);
  });

  it('filters category commands by category and permission', () => {
    const general = createCommandListEmbed(GENERAL_CATEGORY, UserPermission.User);
    const settingsForUser = createCommandListEmbed(SETTINGS_CATEGORY, UserPermission.User);
    const settingsForAdmin = createCommandListEmbed(SETTINGS_CATEGORY, UserPermission.Admin);

    expect(general.header).toEqual({ text: '📁  Category  📁' });
    expect(general.title).toBe('General');
    expect(general.description).toContain('help\ninvite');
    expect(general.description).not.toContain('servers');
    expect(settingsForUser.description).toContain('```\n\n```');
    expect(settingsForAdmin.description).toContain('```\nconfig\n```');
    expect(settingsForAdmin.description).toContain('Use `help <command>`');
  });

  it('renders command metadata and only visible examples in slash form', () => {
    const command: Command = {
      name: 'demo',
      shortName: 'd',
      category: GENERAL_CATEGORY,
      details: 'Demo details',
      permission: UserPermission.DJLimited,
      dmAllowed: true,
      keywords: [KEYWORDS.SHUFFLE],
      patterns: [PATTERNS.TOP],
      usage: [
        { title: 'Visible', example: [KEYWORDS.SHUFFLE, PATTERNS.TOP.ex('3')] },
        { title: 'Hidden', example: 'secret', hide: true },
      ],
      execute: async () => undefined,
    };
    const embed = createCommandDetailsEmbed(command, SyntaxType.SLASH);

    expect(embed.header).toEqual({ text: '📁  Command  📁' });
    expect(embed.title).toBe('demo');
    expect(embed.description).toContain('**Accepted Keywords**\n```\nSHUFFLE```');
    expect(embed.description).toContain('**Accepted Patterns**\n```\nTOP```');
    expect(embed.footer?.text).toBe(
      'Can be used in direct message? Yes\nRequires DJ Role? Limited',
    );
    expect(embed.fields).toEqual([
      {
        name: 'Ex. 1\tVisible',
        value: '```\n/demo shuffle:True top:3\n```',
      },
    ]);
  });

  it('renders keyword details with traditional long and short forms', () => {
    const embed = createKeywordDetailsEmbed(KEYWORDS.NEXT, SyntaxType.TRADITIONAL);

    expect(embed).toMatchObject({
      header: { text: '🚩  Keyword  🚩' },
      title: 'NEXT',
      footer: { text: 'Requires DJ Role? Yes' },
    });
    expect(embed.description).toContain('**Example Usage:**\n```\n-next\n-n```');
  });

  it('renders every pattern example using the selected syntax', () => {
    const embed = createPatternDetailsEmbed(PATTERNS.TOP, SyntaxType.SLASH);

    expect(embed).toMatchObject({
      header: { text: '🚩  Pattern  🚩' },
      title: 'TOP',
      footer: { text: 'Requires DJ Role? No' },
    });
    expect(embed.description).toContain(
      '**Example Usage:**\n```\n' +
        'top:100  # Get the first 100 songs\n' +
        'top:4:10  # Get the 4th song to the 10th song\n' +
        'top:5:-5  # Get the 5th song to the 5th last song```',
    );
    expect(embed.description).toContain("Don't stare at this description too hard");
  });
});
