import { describe, expect, it } from 'vitest';
import { SyntaxType } from '@eolian/command-options/@types';
import { createCommandParsingStrategy } from '@eolian/commands/command-parsing-strategy';
import { UserPermission } from '@eolian/common/constants';

describe('TextCommandParsingStrategy', () => {
  const parser = createCommandParsingStrategy();

  it.each([
    ['!help', undefined, true],
    ['  !help  ', undefined, true],
    ['help', undefined, false],
    ['!', undefined, false],
    ['!!help', undefined, false],
    ['e! help', 'e!', true],
    ['e!', 'e!', false],
    ['e!e! help', 'e!', false],
  ] as const)('detects invocation %s with prefix %s', (message, prefix, expected) => {
    expect(parser.messageInvokesBot(message, prefix)).toBe(expected);
  });

  it('normalizes command names and forwards remaining text into keyword parsing', () => {
    const parsed = parser.parseCommand(
      '  AdD Spotify Playlist ( Daft Punk ) shuffle  ',
      UserPermission.DJLimited,
    );

    expect(parsed.command.name).toBe('add');
    expect(parsed.options).toEqual({
      SPOTIFY: true,
      PLAYLIST: true,
      SHUFFLE: true,
      SEARCH: 'daft punk',
    });
  });

  it('supports traditional syntax and command aliases', () => {
    const parsed = parser.parseCommand(
      'A -spotify -playlist Daft Punk -shuffle',
      UserPermission.DJLimited,
      SyntaxType.TRADITIONAL,
    );

    expect(parsed.command.name).toBe('add');
    expect(parsed.options).toEqual({
      SPOTIFY: true,
      PLAYLIST: true,
      SHUFFLE: true,
      SEARCH: 'Daft Punk',
    });
  });

  it('returns simple positional arguments for commands without option definitions', () => {
    const parsed = parser.parseCommand('pause one   two', UserPermission.DJ);

    expect(parsed.command.name).toBe('pause');
    expect(parsed.options).toEqual({ ARG: ['one', 'two'] });
  });

  it('rejects unknown and unauthorized commands', () => {
    expect(() => parser.parseCommand('missing', UserPermission.Owner)).toThrow(
      'There is no command `missing`',
    );
    expect(() => parser.parseCommand('servers', UserPermission.User)).toThrow(
      'You do not have permission to use this command',
    );
  });
});
