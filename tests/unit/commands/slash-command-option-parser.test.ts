import { describe, expect, it } from 'vitest';
import { PATTERNS } from '@eolian/command-options';
import { CommandOptions } from '@eolian/command-options/@types';
import { Command, ICommandOptionProvider } from '@eolian/commands/@types';
import { COMMANDS } from '@eolian/commands/command-store';
import { SlashCommandOptionParser } from '@eolian/commands/slash-command-option-parser';
import { GENERAL_CATEGORY } from '@eolian/commands/category';
import { UserPermission } from '@eolian/common/constants';

class OptionProvider implements ICommandOptionProvider {
  constructor(
    private readonly strings: Record<string, string | undefined> = {},
    private readonly booleans: Record<string, boolean | undefined> = {},
  ) {}

  getString(name: string) {
    return this.strings[name];
  }

  getBoolean(name: string) {
    return this.booleans[name];
  }
}

const resolve = (
  command: Command,
  provider: ICommandOptionProvider,
  permission = UserPermission.Owner,
): CommandOptions => new SlashCommandOptionParser(command, provider, permission).resolve();

describe('SlashCommandOptionParser', () => {
  it('normalizes grouped choices and forwards boolean, grouped, and ungrouped options', () => {
    const add = COMMANDS.safeGet('add', UserPermission.DJLimited);
    const provider = new OptionProvider(
      {
        source: 'SpOtIfY',
        type: 'playlist',
        search: 'Daft Punk',
        top: '2:4',
      },
      { shuffle: true },
    );

    expect(resolve(add, provider, UserPermission.DJLimited)).toEqual({
      SPOTIFY: true,
      PLAYLIST: true,
      SHUFFLE: true,
      SEARCH: 'Daft Punk',
      TOP: { start: 2, stop: 4 },
    });
  });

  it('parses one selected value from an argument group', () => {
    const help = COMMANDS.safeGet('help', UserPermission.User);

    expect(resolve(help, new OptionProvider({ command: 'add' }), UserPermission.User)).toEqual({
      ARG: ['add'],
    });
  });

  it('rejects conflicting or missing grouped arguments', () => {
    const help = COMMANDS.safeGet('help', UserPermission.User);
    const requiredCommand: Command = {
      name: 'required',
      category: GENERAL_CATEGORY,
      details: 'test',
      permission: UserPermission.User,
      usage: [],
      args: {
        base: false,
        groups: [
          {
            required: true,
            options: [
              { name: 'first', details: 'first' },
              { name: 'second', details: 'second' },
            ],
          },
        ],
      },
      execute: async () => undefined,
    };

    expect(() =>
      resolve(help, new OptionProvider({ command: 'add', category: 'Queue' }), UserPermission.User),
    ).toThrow('You can not specify both command & category');
    expect(() => resolve(requiredCommand, new OptionProvider(), UserPermission.User)).toThrow(
      'You must provide `first` or `second`',
    );
  });

  it('parses simple slash arguments when no option metadata exists', () => {
    const command: Command = {
      name: 'plain',
      category: GENERAL_CATEGORY,
      details: 'test',
      permission: UserPermission.User,
      usage: [],
      execute: async () => undefined,
    };

    expect(resolve(command, new OptionProvider({ args: ' one   two ' }))).toEqual({
      ARG: ['one', 'two'],
    });
  });

  it('rejects malformed patterns and grouped keyword values', () => {
    const add = COMMANDS.safeGet('add', UserPermission.DJLimited);

    expect(() =>
      resolve(add, new OptionProvider({ top: 'not-a-range' }), UserPermission.DJLimited),
    ).toThrow('Provided option `TOP` is incorrectly specified');
    expect(() =>
      resolve(add, new OptionProvider({ source: 'unsupported' }), UserPermission.DJLimited),
    ).toThrow('Unrecognized keyword `UNSUPPORTED`.');
  });

  it('enforces keyword and pattern permissions', () => {
    const command: Command = {
      name: 'restricted',
      category: GENERAL_CATEGORY,
      details: 'test',
      permission: UserPermission.User,
      usage: [],
      keywords: [
        COMMANDS.safeGet('add', UserPermission.DJLimited).keywords!.find(
          keyword => keyword.name === 'NEXT',
        )!,
      ],
      patternsUngrouped: [
        {
          ...PATTERNS.TOP,
          permission: UserPermission.DJ,
        },
      ],
      patternsGrouped: new Map(),
      execute: async () => undefined,
    };

    expect(() =>
      resolve(command, new OptionProvider({}, { next: true }), UserPermission.User),
    ).toThrow('You do not have permission to use NEXT!');
    expect(() => resolve(command, new OptionProvider({ top: '2' }), UserPermission.User)).toThrow(
      'You do not have permission to use TOP!',
    );
  });
});
