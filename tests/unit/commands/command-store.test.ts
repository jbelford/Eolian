import { describe, expect, it } from 'vitest';
import { KeywordGroup } from '@eolian/command-options/@types';
import { UserPermission } from '@eolian/common/constants';
import { COMMANDS, MESSAGE_COMMANDS } from '@eolian/commands/command-store';
import { ACCOUNT_COMMANDS } from '@eolian/commands/account';
import {
  ACCOUNT_CATEGORY,
  COMMAND_CATEGORIES,
  GENERAL_CATEGORY,
  MUSIC_CATEGORY,
  QUEUE_CATEGORY,
  SETTINGS_CATEGORY,
} from '@eolian/commands/category';
import { GENERAL_COMMANDS } from '@eolian/commands/general';
import { MUSIC_COMMANDS, PLAY_MESSAGE_COMMAND } from '@eolian/commands/music';
import { OWNER_COMMANDS } from '@eolian/commands/owner';
import { ADD_MESSAGE_COMMAND, QUEUE_COMMANDS } from '@eolian/commands/queue';
import { SETTINGS_COMMANDS } from '@eolian/commands/settings';

describe('command registration', () => {
  it('registers category command lists in their declared order', () => {
    expect(COMMANDS.list).toEqual([
      ...GENERAL_COMMANDS,
      ...ACCOUNT_COMMANDS,
      ...QUEUE_COMMANDS,
      ...MUSIC_COMMANDS,
      ...SETTINGS_COMMANDS,
    ]);
    expect(COMMANDS.list).toHaveLength(24);
    expect(COMMAND_CATEGORIES).toEqual([
      GENERAL_CATEGORY,
      MUSIC_CATEGORY,
      QUEUE_CATEGORY,
      ACCOUNT_CATEGORY,
      SETTINGS_CATEGORY,
    ]);
  });

  it('looks up canonical names and short aliases', () => {
    expect(COMMANDS.get('add')).toBe(QUEUE_COMMANDS[0]);
    expect(COMMANDS.get('a')).toBe(COMMANDS.get('add'));
    expect(COMMANDS.get('cfg')).toBe(COMMANDS.get('config'));
    expect(COMMANDS.get('ADD')).toBeUndefined();
  });

  it('enforces permissions and reports unknown commands', () => {
    expect(COMMANDS.safeGet('servers', UserPermission.Owner).name).toBe('servers');
    expect(() => COMMANDS.safeGet('servers', UserPermission.Admin)).toThrow(
      'You do not have permission to use this command',
    );
    expect(() => COMMANDS.safeGet('missing', UserPermission.Owner)).toThrow(
      'There is no command `missing`',
    );
  });

  it('precomputes keyword and sorted pattern metadata', () => {
    const add = COMMANDS.safeGet('add', UserPermission.DJLimited);

    expect(add.keywordSet).toEqual(new Set(add.keywords?.map(keyword => keyword.name)));
    expect(add.patterns?.map(pattern => pattern.priority)).toEqual(
      [...(add.patterns ?? [])].map(pattern => pattern.priority).sort((a, b) => b - a),
    );
    expect(add.patternsGrouped?.get(KeywordGroup.Search)?.map(pattern => pattern.name)).toEqual([
      'SEARCH',
      'URL',
    ]);
    expect(add.patternsUngrouped?.map(pattern => pattern.name)).toEqual([
      'IDENTIFIER',
      'TOP',
      'BOTTOM',
      'VOICE',
    ]);
  });

  it('keeps message and owner command registries separate', () => {
    expect(MESSAGE_COMMANDS.list).toEqual([PLAY_MESSAGE_COMMAND, ADD_MESSAGE_COMMAND]);
    expect(MESSAGE_COMMANDS.get('Play')).toBe(PLAY_MESSAGE_COMMAND);
    expect(MESSAGE_COMMANDS.get('play')).toBeUndefined();
    expect(COMMANDS.get('kick')).toBeUndefined();
    expect(OWNER_COMMANDS.get('kick')?.name).toBe('kick');
  });
});
