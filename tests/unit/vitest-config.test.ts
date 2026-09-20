import { matchGroup } from '@eolian/command-options/patterns/patterns-utils';
import { describe, expect, it } from 'vitest';

describe('Vitest configuration', () => {
  it('collects unit tests and resolves source aliases', () => {
    expect(matchGroup('play spotify', /(spotify)/i, 0)).toEqual({
      matches: true,
      newText: 'play ',
      args: 'spotify',
    });
  });
});
