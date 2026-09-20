import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '@eolian/common/env';
import { UserPermission } from '@eolian/common/constants';

const mocks = vi.hoisted(() => ({
  put: vi.fn(),
  setToken: vi.fn(),
}));

vi.mock('discord.js', async importOriginal => {
  const actual = await importOriginal<typeof import('discord.js')>();
  class REST {
    setToken(token: string) {
      mocks.setToken(token);
      return this;
    }
    put(route: string, options: unknown) {
      return mocks.put(route, options);
    }
  }
  return { ...actual, REST };
});

vi.mock('@eolian/commands', () => ({
  COMMANDS: {
    list: [
      {
        name: 'public',
        details: 'd'.repeat(120),
        permission: UserPermission.User,
        dmAllowed: true,
      },
      {
        name: 'admin',
        details: 'Admin command',
        permission: UserPermission.Admin,
      },
      {
        name: 'owner',
        details: 'Owner command',
        permission: UserPermission.Owner,
      },
    ],
  },
  MESSAGE_COMMANDS: {
    list: [{ name: 'Save message' }],
  },
}));

vi.mock('@eolian/command-options', () => ({
  KEYWORD_GROUPS: {},
  PATTERNS: { ARG: { name: 'ARG' } },
}));

import {
  registerGlobalSlashCommands,
  registerGuildSlashCommands,
} from '@eolian/framework/discord-slash-commands';

describe('Discord slash command registration', () => {
  const originalClientId = environment.tokens.discord.clientId;

  beforeEach(() => {
    environment.tokens.discord.clientId = 'client';
    mocks.put.mockResolvedValue(undefined);
  });

  afterEach(() => {
    environment.tokens.discord.clientId = originalClientId;
  });

  it('skips registration without an application client id', async () => {
    environment.tokens.discord.clientId = undefined;
    await expect(registerGlobalSlashCommands()).resolves.toBe(false);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('registers public/admin and message commands while excluding owner commands', async () => {
    await expect(registerGlobalSlashCommands()).resolves.toBe(true);
    expect(mocks.setToken).toHaveBeenCalledWith(environment.tokens.discord.main);

    const [route, request] = mocks.put.mock.calls[0];
    expect(route).toBe('/applications/client/commands');
    const body = request.body as Array<Record<string, unknown>>;
    expect(body.map(command => command.name)).toEqual(['public', 'admin', 'Save message']);
    expect(body[0].description as string).toHaveLength(100);
    expect(body[0].dm_permission).toBe(true);
    expect(body[0].options).toEqual([
      expect.objectContaining({ name: 'args', required: false, type: 3 }),
    ]);
    expect(body[1].default_member_permissions).toBe('0');
  });

  it('uses the guild route and returns false when Discord rejects registration', async () => {
    mocks.put.mockRejectedValueOnce(new Error('Discord unavailable'));
    await expect(registerGuildSlashCommands('guild')).resolves.toBe(false);
    expect(mocks.put).toHaveBeenCalledWith(
      '/applications/client/guilds/guild/commands',
      expect.any(Object),
    );
  });
});
