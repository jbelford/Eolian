import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyntaxType } from '@eolian/command-options/@types';
import { DEFAULT_VOLUME, UserPermission } from '@eolian/common/constants';
import { environment } from '@eolian/common/env';
import { DiscordClient } from '@eolian/framework/discord-client';
import { DiscordGuild } from '@eolian/framework/discord-guild';
import { DiscordUser, getPermissionLevel } from '@eolian/framework/discord-user';

vi.mock('@eolian/api', () => ({
  createAuthCodeRequest: vi.fn(() => ({ tokenProvider: { authorization: {} } })),
}));

vi.mock('@eolian/data', () => ({
  InMemoryLRUCache: class {
    private values = new Map<string, unknown>();
    get(id: string) {
      return this.values.get(id);
    }
    set(id: string, value: unknown) {
      if (value === undefined) this.values.delete(id);
      else this.values.set(id, value);
    }
  },
}));

vi.mock('@eolian/framework/discord-authorization-provider', () => ({
  DiscordAuthorizationProvider: class {
    constructor(..._args: unknown[]) {}
  },
}));

vi.mock('@eolian/framework/voice', () => ({
  DiscordVoiceChannel: class {
    constructor(public channel: unknown) {}
  },
  DiscordVoiceConnection: class {},
}));

vi.mock('@eolian/framework/discord-slash-commands', () => ({
  registerGlobalSlashCommands: vi.fn().mockResolvedValue(true),
}));

function createServers() {
  return {
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(true),
    getIdleServers: vi.fn().mockResolvedValue([]),
    setLastUsage: vi.fn().mockResolvedValue(undefined),
    setPreferredChannel: vi.fn().mockResolvedValue(undefined),
    setPrefix: vi.fn().mockResolvedValue(undefined),
    setVolume: vi.fn().mockResolvedValue(undefined),
    setSyntax: vi.fn().mockResolvedValue(undefined),
    addDjRole: vi.fn().mockResolvedValue(undefined),
    removeDjRole: vi.fn().mockResolvedValue(true),
    setDjAllowLimited: vi.fn().mockResolvedValue(undefined),
  };
}

function createUsers() {
  return {
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(true),
    setSoundCloud: vi.fn(),
    removeSoundCloud: vi.fn(),
    setSoundCloudRefreshToken: vi.fn(),
    removeSoundCloudRefreshToken: vi.fn(),
    setSpotifyRefreshToken: vi.fn(),
    setSpotify: vi.fn(),
    removeSpotify: vi.fn(),
    removeSpotifyRefreshToken: vi.fn(),
    setIdentifier: vi.fn(),
    removeIdentifier: vi.fn().mockResolvedValue(true),
    setSyntax: vi.fn(),
    removeSyntax: vi.fn(),
  };
}

describe('DiscordGuild', () => {
  beforeEach(() => {
    environment.youtubeAllowList.clear();
  });

  function guild() {
    return {
      id: 'guild',
      name: 'Guild',
      memberCount: 10,
      ownerId: 'owner',
      iconURL: vi.fn(() => null),
      roles: { cache: new Map([['dj', {}]]) },
    };
  }

  it('builds and caches defaults when no server record exists', async () => {
    const servers = createServers();
    const wrapper = new DiscordGuild(servers as never, guild() as never);

    const first = await wrapper.get();
    expect(first).toEqual({
      _id: 'guild',
      prefix: environment.cmdToken,
      volume: DEFAULT_VOLUME,
      syntax: SyntaxType.KEYWORD,
      queueLimit: environment.config.queueLimit,
    });
    expect(await wrapper.get()).toBe(first);
    expect(servers.get).toHaveBeenCalledOnce();
  });

  it('validates prefix and volume before updating persistence', async () => {
    const servers = createServers();
    const wrapper = new DiscordGuild(servers as never, guild() as never);
    await expect(wrapper.setPrefix('!!')).rejects.toThrow('Prefix must be length 1');
    await expect(wrapper.setVolume(-0.1)).rejects.toThrow('Volume must be between 0 and 1');
    await expect(wrapper.setVolume(1.1)).rejects.toThrow('Volume must be between 0 and 1');
    expect(servers.setPrefix).not.toHaveBeenCalled();
    expect(servers.setVolume).not.toHaveBeenCalled();
  });

  it('updates cached configuration and validates DJ roles', async () => {
    const servers = createServers();
    const wrapper = new DiscordGuild(servers as never, guild() as never);
    const config = await wrapper.get();

    await wrapper.setPrefix('?');
    await wrapper.setVolume(0.5);
    await wrapper.setChannel('music');
    await wrapper.setSyntax(SyntaxType.TRADITIONAL);
    await wrapper.setDjLimited(true);
    expect(await wrapper.addDjRole('missing')).toBe(false);
    expect(await wrapper.addDjRole('dj')).toBe(true);
    expect(await wrapper.removeDjRole('dj')).toBe(true);

    expect(config).toMatchObject({
      prefix: '?',
      volume: 0.5,
      preferredChannelId: 'music',
      syntax: SyntaxType.TRADITIONAL,
      djAllowLimited: true,
      djRoleIds: [],
    });
    expect(servers.addDjRole).toHaveBeenCalledWith('guild', 'dj');
  });

  it('throttles usage writes for one hour', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00Z'));
    const servers = createServers();
    const wrapper = new DiscordGuild(servers as never, guild() as never);

    await wrapper.updateUsage('first');
    await vi.advanceTimersByTimeAsync(30 * 60 * 1000);
    await wrapper.updateUsage('second');
    await vi.advanceTimersByTimeAsync(31 * 60 * 1000);
    await wrapper.updateUsage('third');

    expect(servers.setLastUsage).toHaveBeenCalledTimes(2);
    expect(servers.setLastUsage.mock.calls[0][2]).toBe('first');
    expect(servers.setLastUsage.mock.calls[1][2]).toBe('third');
    vi.useRealTimers();
  });
});

describe('DiscordUser', () => {
  function rawUser(id: string) {
    return {
      id,
      username: 'Ada',
      avatarURL: vi.fn(() => 'https://example.test/avatar.png'),
      send: vi.fn(),
    };
  }

  it('assigns owner, administrator, and ordinary permissions in priority order', () => {
    environment.owners.push('owner-test');
    expect(getPermissionLevel(rawUser('owner-test') as never, { has: () => true } as never)).toBe(
      UserPermission.Owner,
    );
    environment.owners.pop();
    expect(getPermissionLevel(rawUser('admin') as never, { has: () => true } as never)).toBe(
      UserPermission.Admin,
    );
    expect(getPermissionLevel(rawUser('user') as never, null)).toBe(UserPermission.User);
  });

  it('promotes users according to configured DJ roles and limited mode', async () => {
    const users = createUsers();
    const member = {
      roles: { cache: new Map([['dj', {}]]) },
      voice: { channel: null },
    };
    const user = new DiscordUser(
      rawUser('permissions') as never,
      users as never,
      UserPermission.User,
      {} as never,
      member as never,
    );
    await user.updatePermissions({
      get: vi.fn().mockResolvedValue({ djRoleIds: ['dj'] }),
    } as never);
    expect(user.permission).toBe(UserPermission.DJ);

    const limited = new DiscordUser(
      rawUser('limited') as never,
      users as never,
      UserPermission.User,
      {} as never,
      { roles: { cache: new Map() }, voice: { channel: null } } as never,
    );
    await limited.updatePermissions({
      get: vi.fn().mockResolvedValue({ djRoleIds: ['dj'], djAllowLimited: true }),
    } as never);
    expect(limited.permission).toBe(UserPermission.DJLimited);
  });

  it('caches user data and keeps cached mutations synchronized with persistence', async () => {
    const users = createUsers();
    users.get.mockResolvedValueOnce({ _id: 'cached-user' });
    const auth = { removeUserRequest: vi.fn().mockResolvedValue(undefined) };
    const user = new DiscordUser(
      rawUser('cached-user') as never,
      users as never,
      UserPermission.User,
      auth as never,
    );

    const dto = await user.get();
    await user.setSpotify('spotify');
    await user.setSoundCloud(42);
    await user.setSyntax(SyntaxType.TRADITIONAL);
    await user.setIdentifier('mix', { id: 'id' } as never);
    expect(await user.removeIdentifier('mix')).toBe(true);
    expect(dto).toMatchObject({
      spotify: 'spotify',
      soundcloud: 42,
      syntax: SyntaxType.TRADITIONAL,
      identifiers: {},
    });
    expect(await user.get()).toBe(dto);
    expect(users.get).toHaveBeenCalledOnce();
  });

  it('clears auth and cached data before deleting the database record', async () => {
    const users = createUsers();
    users.get.mockResolvedValueOnce({ _id: 'clear-user' });
    const auth = { removeUserRequest: vi.fn().mockResolvedValue(undefined) };
    const user = new DiscordUser(
      rawUser('clear-user') as never,
      users as never,
      UserPermission.User,
      auth as never,
    );
    await user.get();
    expect(await user.clearData()).toBe(true);
    expect(auth.removeUserRequest).toHaveBeenCalledWith('clear-user');
    expect(users.delete).toHaveBeenCalledWith('clear-user');
  });
});

describe('DiscordClient', () => {
  function guild(id: string, botCount: number, persisted: boolean) {
    const members = Array.from({ length: 4 }, (_, index) => ({
      user: { bot: index < botCount },
    }));
    return {
      persisted,
      id,
      name: `Guild ${id}`,
      memberCount: 4,
      ownerId: `owner-${id}`,
      members: {
        cache: {
          filter: (predicate: (member: (typeof members)[number]) => boolean) => ({
            size: members.filter(predicate).length,
          }),
        },
      },
      leave: vi.fn().mockResolvedValue(true),
    };
  }

  it('maps guilds, delegates database queries, and reports active state count', async () => {
    const first = guild('one', 1, true);
    const second = guild('two', 2, false);
    const guilds = [first, second];
    const client = {
      user: { username: 'Eolian', avatarURL: () => null },
      guilds: {
        cache: {
          map: (mapper: (guild: never) => unknown) => guilds.map(g => mapper(g as never)),
          get: (id: string) => guilds.find(g => g.id === id),
        },
      },
      generateInvite: vi.fn(() => 'invite'),
    };
    const servers = createServers();
    servers.get.mockImplementation(async id => (id === 'one' ? { _id: id } : null));
    const wrapper = new DiscordClient(client as never, { active: 3 } as never, servers as never);

    expect(wrapper.name).toBe('Eolian');
    expect(wrapper.pic).toBeUndefined();
    expect(wrapper.generateInvite()).toBe('invite');
    expect(wrapper.getServers()[1]).toMatchObject({ id: 'two', botCount: 2, botRatio: 0.5 });
    expect((await wrapper.getUnusedServers()).map(server => server.id)).toEqual(['two']);
    expect(wrapper.getRecentlyUsedCount()).toBe(3);
    expect(await wrapper.leave('one')).toBe(true);
    expect(servers.delete).toHaveBeenCalledWith('one');
    expect(first.leave).toHaveBeenCalledOnce();
  });
});
