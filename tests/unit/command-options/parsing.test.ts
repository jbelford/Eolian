import { describe, expect, it, vi } from 'vitest';

vi.mock('@eolian/common/util', () => ({
  convertRangeToAbsolute: vi.fn(),
}));

import { UserPermission } from '@eolian/common/constants';
import { EolianUserError } from '@eolian/common/errors';
import { Pattern, SyntaxType } from '@eolian/command-options/@types';
import { KEYWORDS } from '@eolian/command-options/keywords';
import { CommandOptionBuilder } from '@eolian/command-options/parsing/command-option-builder';
import { CommandOptionsParser } from '@eolian/command-options/parsing/command-options-parser';
import { SEARCH_PATTERN } from '@eolian/command-options/patterns/search-pattern';
import { TOP_PATTERN } from '@eolian/command-options/patterns/top-pattern';

describe('CommandOptionBuilder', () => {
  it('adds matched patterns and returns remaining text', () => {
    const builder = new CommandOptionBuilder(UserPermission.User);

    expect(builder.withPattern(TOP_PATTERN, 'song TOP 3')).toBe('song');
    expect(builder.get()).toEqual({ TOP: { start: 3 } });
  });

  it('throws a user-facing error for a required malformed pattern', () => {
    const builder = new CommandOptionBuilder(UserPermission.User);

    expect(() => builder.withPattern(TOP_PATTERN, 'TOP nope', true)).toThrow(EolianUserError);
    expect(() => builder.withPattern(TOP_PATTERN, 'TOP nope', true)).toThrow(
      'Provided option `TOP` is incorrectly specified',
    );
  });

  it('enforces pattern and keyword permissions', () => {
    const ownerPattern: Pattern<'SEARCH'> = {
      ...SEARCH_PATTERN,
      permission: UserPermission.Owner,
      matchText: () => ({ matches: true, newText: '', args: 'secret' }),
    };
    const builder = new CommandOptionBuilder(UserPermission.User);

    expect(() => builder.withPattern(ownerPattern, 'secret')).toThrow(
      'You do not have permission to use SEARCH!',
    );
    expect(() => builder.withKeyword(KEYWORDS.NEXT)).toThrow(
      'You do not have permission to use NEXT!',
    );
  });

  it('rejects known but unsupported keywords', () => {
    const builder = new CommandOptionBuilder(UserPermission.Owner);

    expect(() => builder.withKeyword(KEYWORDS.SHUFFLE, false)).toThrow(
      'This command does not accept the `SHUFFLE` keyword.',
    );
  });

  it('captures trimmed text arguments', () => {
    const builder = new CommandOptionBuilder(UserPermission.User);
    builder.withTextArgs('  one   two  ');

    expect(builder.get()).toEqual({ ARG: ['one', 'two'] });
  });
});

describe('CommandOptionsParser', () => {
  it('returns plain arguments when no option definitions are supplied', () => {
    expect(
      new CommandOptionsParser(SyntaxType.KEYWORD).resolve('one two', UserPermission.User),
    ).toEqual({ ARG: ['one', 'two'] });
  });

  it('parses allowed keyword syntax and short aliases case-insensitively', () => {
    const options = new CommandOptionsParser(SyntaxType.KEYWORD).resolve(
      'play ON shuffle f',
      UserPermission.User,
      new Set(['ENABLE', 'SHUFFLE', 'FAST']),
    );

    expect(options).toEqual({ ENABLE: true, SHUFFLE: true, FAST: true });
  });

  it('rejects recognized keyword syntax not accepted by the command', () => {
    expect(() =>
      new CommandOptionsParser(SyntaxType.KEYWORD).resolve(
        'play shuffle',
        UserPermission.User,
        new Set(['FAST']),
      ),
    ).toThrow('This command does not accept the `SHUFFLE` keyword.');
  });

  it('parses traditional flags and assigns remaining text to search', () => {
    const options = new CommandOptionsParser(SyntaxType.TRADITIONAL).resolve(
      '-shuffle Daft Punk -f',
      UserPermission.User,
      new Set(['SHUFFLE', 'FAST']),
      [SEARCH_PATTERN],
    );

    expect(options).toEqual({ SHUFFLE: true, FAST: true, SEARCH: 'Daft Punk' });
  });

  it('rejects unknown traditional flags', () => {
    expect(() =>
      new CommandOptionsParser(SyntaxType.TRADITIONAL).resolve(
        '-mystery song',
        UserPermission.User,
        new Set(),
      ),
    ).toThrow('Unrecognized keyword `MYSTERY`.');
  });

  it('parses slash pattern values without keyword flag syntax', () => {
    expect(
      new CommandOptionsParser(SyntaxType.SLASH).resolve('3:5', UserPermission.User, undefined, [
        TOP_PATTERN,
      ]),
    ).toEqual({ TOP: { start: 3, stop: 5 } });
  });
});
