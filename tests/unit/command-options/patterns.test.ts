import { describe, expect, it, vi } from 'vitest';

vi.mock('@eolian/common/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn() } }));

import { TrackSource } from '@eolian/api/@types';
import { SyntaxType } from '@eolian/command-options/@types';
import { ARG_PATTERN } from '@eolian/command-options/patterns/arg-pattern';
import { BOTTOM_PATTERN } from '@eolian/command-options/patterns/bottom-pattern';
import { IDENTIFIER_PATTERN } from '@eolian/command-options/patterns/identifier-pattern';
import { NUMBER_PATTERN } from '@eolian/command-options/patterns/number-pattern';
import { PATTERNS_SORTED, getRangeOption } from '@eolian/command-options/patterns';
import { SEARCH_PATTERN } from '@eolian/command-options/patterns/search-pattern';
import { TOP_PATTERN } from '@eolian/command-options/patterns/top-pattern';
import { URL_PATTERN } from '@eolian/command-options/patterns/url-pattern';
import { VOICE_PATTERN } from '@eolian/command-options/patterns/voice-pattern';

describe('command option patterns', () => {
  it.each([
    [TOP_PATTERN, 'play TOP 4:10 now', SyntaxType.KEYWORD, { start: 4, stop: 10 }],
    [TOP_PATTERN, 'play -top 5:-2 now', SyntaxType.TRADITIONAL, { start: 5, stop: -2 }],
    [BOTTOM_PATTERN, 'BOTTOM 3', SyntaxType.KEYWORD, { start: 3 }],
    [BOTTOM_PATTERN, '2:7', SyntaxType.SLASH, { start: 2, stop: 7 }],
  ] as const)('parses range pattern %s', (pattern, text, syntax, expected) => {
    const result = pattern.matchText(text, syntax);

    expect(result.matches).toBe(true);
    expect(result.args).toEqual(expected);
    expect(result.newText).not.toMatch(/top|bottom|\d/i);
  });

  it.each([TOP_PATTERN, BOTTOM_PATTERN])('leaves malformed ranges unmatched', pattern => {
    expect(pattern.matchText(`${pattern.name} nope`, SyntaxType.KEYWORD)).toEqual({
      matches: false,
      newText: `${pattern.name} nope`,
      args: undefined,
    });
  });

  it('parses all standalone numbers while preserving surrounding text', () => {
    expect(NUMBER_PATTERN.matchText('gain -1 0.5 and 12x 3', SyntaxType.KEYWORD)).toEqual({
      matches: true,
      newText: 'gain   and 12x ',
      args: [-1, 0.5, 3],
    });
  });

  it('parses slash-delimited arguments', () => {
    expect(ARG_PATTERN.matchText('before / one / two words / after', SyntaxType.KEYWORD)).toEqual({
      matches: true,
      newText: 'before  after',
      args: ['one', 'two words'],
    });
  });

  it('parses identifiers by syntax', () => {
    expect(IDENTIFIER_PATTERN.matchText('play [ My Mix ] next', SyntaxType.KEYWORD)).toMatchObject({
      matches: true,
      newText: 'play  next',
      args: 'my mix',
    });
    expect(IDENTIFIER_PATTERN.matchText('  My Mix  ', SyntaxType.SLASH)).toEqual({
      matches: true,
      newText: '',
      args: 'My Mix',
    });
  });

  it('parses explicit and passthrough searches', () => {
    expect(SEARCH_PATTERN.matchText('play ( Daft Punk ) now', SyntaxType.KEYWORD)).toMatchObject({
      matches: true,
      args: 'daft punk',
    });
    expect(SEARCH_PATTERN.matchText('  Daft Punk  ', SyntaxType.TRADITIONAL)).toEqual({
      matches: true,
      newText: '',
      args: 'Daft Punk',
    });
  });

  it.each([
    ['https://www.youtube.com/watch?v=abc', TrackSource.YouTube],
    ['youtu.be/abc', TrackSource.YouTube],
    ['soundcloud.com/artist/song', TrackSource.SoundCloud],
    ['spotify:album:abc', TrackSource.Spotify],
    ['https://example.com/resource', TrackSource.Unknown],
  ])('classifies URL %s', (value, source) => {
    expect(URL_PATTERN.matchText(`play ${value} now`, SyntaxType.KEYWORD)).toMatchObject({
      matches: true,
      args: { value, source },
    });
  });

  it('does not treat arbitrary text as a URL', () => {
    expect(URL_PATTERN.matchText('ordinary search terms', SyntaxType.KEYWORD)).toEqual({
      matches: false,
      newText: 'ordinary search terms',
      args: undefined,
    });
  });

  it.each([
    ['VOICE 2', SyntaxType.KEYWORD, 2],
    ['-voice 3', SyntaxType.TRADITIONAL, 3],
    ['4', SyntaxType.SLASH, 4],
  ])('parses voice syntax %s', (text, syntax, voice) => {
    expect(VOICE_PATTERN.matchText(text, syntax)).toMatchObject({ matches: true, args: voice });
  });

  it('orders patterns from highest to lowest priority', () => {
    expect(PATTERNS_SORTED.map(pattern => pattern.priority)).toEqual(
      [...PATTERNS_SORTED].map(pattern => pattern.priority).sort((a, b) => b - a),
    );
  });

  it('converts top and bottom options to inclusive user-facing ranges', () => {
    expect(getRangeOption({ TOP: { start: 2, stop: 4 } }, 10)).toEqual({
      start: 1,
      stop: 4,
    });
    expect(getRangeOption({ BOTTOM: { start: 2, stop: 4 } }, 10)).toEqual({
      start: 6,
      stop: 9,
    });
    expect(getRangeOption({}, 10)).toBeUndefined();
  });

  it('renders pattern examples for each syntax', () => {
    expect(TOP_PATTERN.ex('5').text(SyntaxType.KEYWORD)).toBe('top 5');
    expect(TOP_PATTERN.ex('5').text(SyntaxType.TRADITIONAL)).toBe('-top 5');
    expect(TOP_PATTERN.ex('5').text(SyntaxType.SLASH)).toBe('top:5');
    expect(ARG_PATTERN.ex('one', 'two').text(SyntaxType.SLASH)).toBe('arg:/ one / two /');
  });
});
