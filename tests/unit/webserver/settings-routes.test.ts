import { TrackSource } from '@eolian/api/@types';
import { SyntaxType } from '@eolian/command-options/@types';
import { environment } from '@eolian/common/env';
import {
  AppDatabase,
  DiscordSessionGuild,
  SessionDTO,
  SessionsDb,
  UserDTO,
} from '@eolian/data/@types';
import {
  DiscordManagement,
  DiscordManagementError,
  ManagedGuild,
} from '@eolian/framework/discord-management';
import { IAuthServiceProvider } from '@eolian/framework/@types';
import { TokenResponseWithRefresh } from '@eolian/http/@types';
import { DiscordOAuthClient } from '@eolian/webserver/auth/@types';
import { CSRF_HEADER, SESSION_COOKIE } from '@eolian/webserver/auth/constants';
import { sessionKey } from '@eolian/webserver/auth/crypto';
import { createAuthSecurity } from '@eolian/webserver/auth/security';
import { registerSettingsRoutes } from '@eolian/webserver/settings/routes';
import fastify, { FastifyInstance } from 'fastify';
import { PermissionFlagsBits } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enabledProviders: new Set<number>(),
  warn: vi.fn(),
}));

vi.mock('@eolian/data', async importOriginal => {
  const actual = await importOriginal<typeof import('@eolian/data')>();
  return {
    ...actual,
    feature: { enabled: vi.fn((flag: number) => mocks.enabledProviders.has(flag)) },
  };
});

vi.mock('@eolian/common/logger', () => ({
  logger: { warn: mocks.warn },
}));

const now = new Date('2026-09-22T08:00:00.000Z');
const rawSessionId = 'settings-session';
const csrfToken = 'settings-csrf';
const userId = '500';
const guildId = '100';

class MemorySessions implements SessionsDb {
  records = new Map<string, SessionDTO>();
  initialize = vi.fn(async () => undefined);
  create = vi.fn(async (record: SessionDTO) => {
    this.records.set(record._id, structuredClone(record));
  });
  get = vi.fn(async (id: string) => {
    const record = this.records.get(id);
    return record ? structuredClone(record) : null;
  });
  delete = vi.fn(async (id: string) => this.records.delete(id));
  update = vi.fn(async (id: string, values: Partial<Omit<SessionDTO, '_id'>>) => {
    const record = this.records.get(id);
    if (!record) return false;
    Object.assign(record, structuredClone(values));
    return true;
  });
  renew = vi.fn(async () => false);
}

function claim(
  id = guildId,
  permissions = PermissionFlagsBits.ManageGuild.toString(),
  owner = false,
): DiscordSessionGuild {
  return { id, name: `Guild ${id}`, icon: null, owner, permissions };
}

function session(guilds = [claim()], refreshedAt = now): SessionDTO {
  return {
    _id: sessionKey(rawSessionId, environment.sessionSecret),
    user: {
      id: userId,
      username: 'settings-user',
      globalName: 'Settings User',
      avatar: null,
    },
    tokens: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      scope: 'identify guilds',
      expiresAt: new Date('2026-09-22T10:00:00.000Z'),
    },
    guilds,
    guildsRefreshedAt: refreshedAt,
    csrfToken,
    createdAt: now,
    renewedAt: now,
    expiresAt: new Date('2026-09-29T08:00:00.000Z'),
  };
}

function managedGuild(overrides: Partial<ManagedGuild> = {}): ManagedGuild {
  return {
    id: guildId,
    name: 'Guild',
    icon: null,
    memberCount: 10,
    settings: {
      prefix: '!',
      volume: 0.1,
      syntax: SyntaxType.KEYWORD,
      preferredChannelId: null,
      djRoleIds: [],
      djAllowLimited: false,
    },
    channels: [{ id: '300', name: 'music' }],
    roles: [{ id: '200', name: 'DJ' }],
    ...overrides,
  };
}

function createDatabase(sessions: MemorySessions, user: UserDTO | null = null): AppDatabase {
  const users = {
    get: vi.fn().mockResolvedValue(user),
    delete: vi.fn(),
    setSoundCloud: vi.fn(),
    removeSoundCloud: vi.fn().mockResolvedValue(undefined),
    setSoundCloudRefreshToken: vi.fn().mockResolvedValue(undefined),
    removeSoundCloudRefreshToken: vi.fn().mockResolvedValue(undefined),
    setSpotifyRefreshToken: vi.fn().mockResolvedValue(undefined),
    setSpotify: vi.fn(),
    removeSpotify: vi.fn().mockResolvedValue(undefined),
    removeSpotifyRefreshToken: vi.fn().mockResolvedValue(undefined),
    setIdentifier: vi.fn(),
    removeIdentifier: vi.fn(),
    setSyntax: vi.fn().mockResolvedValue(undefined),
    removeSyntax: vi.fn().mockResolvedValue(undefined),
  };
  return {
    users,
    servers: {} as AppDatabase['servers'],
    sessions,
    close: vi.fn(),
  };
}

function createOAuthClient(refreshedGuilds = [claim()]): DiscordOAuthClient {
  return {
    authorizationUrl: vi.fn(),
    exchangeCode: vi.fn(),
    refreshToken: vi.fn(),
    getCurrentUser: vi.fn(),
    getCurrentUserGuilds: vi.fn().mockResolvedValue(refreshedGuilds),
  };
}

function createManagement(): DiscordManagement {
  return {
    listGuilds: vi.fn(() => [
      { id: guildId, name: 'Guild', icon: null },
      { id: '101', name: 'Other', icon: null },
    ]),
    getGuild: vi.fn().mockResolvedValue(managedGuild()),
    updateGuild: vi.fn().mockResolvedValue(managedGuild()),
  };
}

function createAuthProviders() {
  let complete: ((token: TokenResponseWithRefresh) => Promise<void>) | undefined;
  const response = Promise.resolve({
    access_token: 'access',
    refresh_token: 'provider-refresh',
    scope: 'scope',
    expires_in: 3600,
  });
  const service = {
    authorize: vi.fn(callback => {
      complete = callback;
      return { link: 'https://provider.example/authorize', response };
    }),
    callback: vi.fn(),
  };
  const provider = {
    getService: vi.fn(() => service),
    getUserRequest: vi.fn(),
    setUserRequest: vi.fn(),
    removeUserRequest: vi.fn().mockResolvedValue(undefined),
    close: vi.fn(),
  } as unknown as IAuthServiceProvider;
  return { provider, service, complete: () => complete };
}

async function createServer(
  options: {
    record?: SessionDTO;
    user?: UserDTO | null;
    refreshedGuilds?: DiscordSessionGuild[];
    management?: DiscordManagement;
  } = {},
) {
  const sessions = new MemorySessions();
  sessions.records.set(
    sessionKey(rawSessionId, environment.sessionSecret),
    options.record ?? session(),
  );
  const database = createDatabase(sessions, options.user);
  const oauthClient = createOAuthClient(options.refreshedGuilds);
  const security = createAuthSecurity(sessions, oauthClient, () => now);
  const auth = createAuthProviders();
  const management = options.management ?? createManagement();
  const server = fastify({ ajv: { customOptions: { removeAdditional: false } } });
  server.decorateRequest('authSession');
  await server.register(registerSettingsRoutes, {
    database,
    management,
    security,
    authProviders: auth.provider,
  });
  await server.ready();
  return { auth, database, management, oauthClient, server, sessions };
}

function authHeaders(mutation = false) {
  return {
    cookie: `${SESSION_COOKIE}=${rawSessionId}`,
    ...(mutation ? { origin: 'http://localhost:8080', [CSRF_HEADER]: csrfToken } : undefined),
  };
}

async function close(server: FastifyInstance) {
  await server.close();
}

describe('settings routes', () => {
  beforeEach(() => {
    mocks.enabledProviders.clear();
  });

  it('requires authentication and returns only sanitized account settings', async () => {
    const { server } = await createServer({
      user: {
        _id: userId,
        syntax: SyntaxType.TRADITIONAL,
        spotify: 'private-id',
        tokens: { soundcloud: 'private-token' },
        identifiers: { private: { id: 'secret' } as never },
      },
    });

    const unauthenticated = await server.inject({ method: 'GET', url: '/api/account' });
    const response = await server.inject({
      method: 'GET',
      url: '/api/account',
      headers: authHeaders(),
    });
    await close(server);

    expect(unauthenticated.statusCode).toBe(401);
    expect(response.json()).toEqual({
      syntax: 'traditional',
      providers: {
        spotify: { linked: true, linkAvailable: false },
        soundcloud: { linked: true, linkAvailable: false },
      },
    });
    expect(response.body).not.toContain('private');
  });

  it('updates and resets personal syntax with authentication, origin, and CSRF guards', async () => {
    const { database, server } = await createServer();
    const request = {
      method: 'PATCH' as const,
      url: '/api/account/syntax',
      payload: { syntax: 'keyword' },
    };

    expect((await server.inject(request)).statusCode).toBe(401);
    expect(
      (
        await server.inject({
          ...request,
          headers: { cookie: `${SESSION_COOKIE}=${rawSessionId}`, origin: 'https://evil.test' },
        })
      ).json().error.code,
    ).toBe('invalid_origin');
    expect(
      (
        await server.inject({
          ...request,
          headers: {
            cookie: `${SESSION_COOKIE}=${rawSessionId}`,
            origin: 'http://localhost:8080',
          },
        })
      ).json().error.code,
    ).toBe('invalid_csrf');

    const updated = await server.inject({ ...request, headers: authHeaders(true) });
    const reset = await server.inject({
      ...request,
      headers: authHeaders(true),
      payload: { syntax: null },
    });
    await close(server);

    expect(updated.statusCode).toBe(200);
    expect(database.users.setSyntax).toHaveBeenCalledWith(userId, SyntaxType.KEYWORD);
    expect(reset.statusCode).toBe(200);
    expect(database.users.removeSyntax).toHaveBeenCalledWith(userId);
  });

  it.each([
    [{ syntax: 'slash' }, 'invalid_request'],
    [{ syntax: 'keyword', extra: true }, 'invalid_request'],
    [{}, 'invalid_request'],
  ])('rejects invalid personal syntax payload %#', async (payload, code) => {
    const { server } = await createServer();
    const response = await server.inject({
      method: 'PATCH',
      url: '/api/account/syntax',
      headers: authHeaders(true),
      payload,
    });
    await close(server);
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe(code);
  });

  it('starts provider linking, persists only the refresh token, and unlinks safely', async () => {
    mocks.enabledProviders.add(0);
    const { auth, database, server } = await createServer();

    const linked = await server.inject({
      method: 'POST',
      url: '/api/account/providers/spotify/link',
      headers: authHeaders(true),
    });
    await auth.complete()!({
      access_token: 'access',
      refresh_token: 'provider-refresh',
      scope: 'scope',
      expires_in: 3600,
    });
    const unlinked = await server.inject({
      method: 'DELETE',
      url: '/api/account/providers/spotify',
      headers: authHeaders(true),
    });
    await close(server);

    expect(linked.statusCode).toBe(201);
    expect(linked.json()).toEqual({
      authorizationUrl: 'https://provider.example/authorize',
    });
    expect(database.users.setSpotifyRefreshToken).toHaveBeenCalledWith(userId, 'provider-refresh');
    expect(unlinked.statusCode).toBe(204);
    expect(auth.provider.removeUserRequest).toHaveBeenCalledWith(userId, TrackSource.Spotify);
    expect(database.users.removeSpotify).toHaveBeenCalledWith(userId);
    expect(database.users.removeSpotifyRefreshToken).toHaveBeenCalledWith(userId);
  });

  it('reports unavailable provider linking and persistence failures', async () => {
    const unavailable = await createServer();
    const response = await unavailable.server.inject({
      method: 'POST',
      url: '/api/account/providers/spotify/link',
      headers: authHeaders(true),
    });
    await close(unavailable.server);
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('provider_link_unavailable');

    const failing = await createServer();
    vi.mocked(failing.database.users.removeSoundCloud).mockRejectedValueOnce(
      new Error('database failed'),
    );
    const failed = await failing.server.inject({
      method: 'DELETE',
      url: '/api/account/providers/soundcloud',
      headers: authHeaders(true),
    });
    await close(failing.server);
    expect(failed.statusCode).toBe(500);
    expect(failed.json().error.code).toBe('persistence_failed');
  });

  it('refreshes stale claims and filters guilds shared with the bot', async () => {
    const stale = session([claim('999', '0')], new Date('2026-09-22T07:00:00.000Z'));
    const { oauthClient, server } = await createServer({
      record: stale,
      refreshedGuilds: [claim(guildId), claim('999', '0')],
    });

    const response = await server.inject({
      method: 'GET',
      url: '/api/guilds',
      headers: authHeaders(),
    });
    await close(server);

    expect(oauthClient.getCurrentUserGuilds).toHaveBeenCalledWith('access-token');
    expect(response.json()).toEqual({
      guilds: [{ id: guildId, name: 'Guild', icon: null }],
    });
  });

  it('requires current manage claims before each guild read or mutation', async () => {
    const { management, server } = await createServer({ record: session([claim(guildId, '0')]) });

    const read = await server.inject({
      method: 'GET',
      url: `/api/guilds/${guildId}`,
      headers: authHeaders(),
    });
    const mutation = await server.inject({
      method: 'PATCH',
      url: `/api/guilds/${guildId}`,
      headers: authHeaders(true),
      payload: { prefix: '?' },
    });
    await close(server);

    expect(read.statusCode).toBe(403);
    expect(mutation.statusCode).toBe(403);
    expect(management.getGuild).not.toHaveBeenCalled();
    expect(management.updateGuild).not.toHaveBeenCalled();
  });

  it('returns guild metadata and effective settings without internal fields', async () => {
    const { server } = await createServer();
    const response = await server.inject({
      method: 'GET',
      url: `/api/guilds/${guildId}`,
      headers: authHeaders(),
    });
    await close(server);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: guildId,
      name: 'Guild',
      icon: null,
      memberCount: 10,
      settings: {
        prefix: '!',
        volume: 0.1,
        syntax: 'keyword',
        preferredChannelId: null,
        djRoleIds: [],
        djAllowLimited: false,
      },
      channels: [{ id: '300', name: 'music' }],
      roles: [{ id: '200', name: 'DJ' }],
    });
  });

  it('applies a complete valid guild update', async () => {
    const { management, server } = await createServer();
    const payload = {
      prefix: '?',
      volume: 0.75,
      syntax: 'traditional',
      preferredChannelId: '300',
      djRoleIds: ['200'],
      djAllowLimited: true,
    };
    const response = await server.inject({
      method: 'PATCH',
      url: `/api/guilds/${guildId}`,
      headers: authHeaders(true),
      payload,
    });
    await close(server);

    expect(response.statusCode).toBe(200);
    expect(management.updateGuild).toHaveBeenCalledWith(guildId, {
      ...payload,
      syntax: SyntaxType.TRADITIONAL,
    });
  });

  it.each([
    [{}, 'invalid_request'],
    [{ prefix: '' }, 'invalid_request'],
    [{ prefix: '!!' }, 'invalid_request'],
    [{ volume: -0.01 }, 'invalid_request'],
    [{ volume: 1.01 }, 'invalid_request'],
    [{ syntax: 'slash' }, 'invalid_request'],
    [{ preferredChannelId: 'not-an-id' }, 'invalid_request'],
    [{ djRoleIds: ['200', '200'] }, 'invalid_request'],
    [{ djRoleIds: Array.from({ length: 11 }, (_, index) => String(index + 1)) }, 'invalid_request'],
    [{ extra: true }, 'invalid_request'],
  ])('rejects guild validation boundary %#', async (payload, code) => {
    const { server } = await createServer();
    const response = await server.inject({
      method: 'PATCH',
      url: `/api/guilds/${guildId}`,
      headers: authHeaders(true),
      payload,
    });
    await close(server);
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe(code);
  });

  it.each([
    ['bot_not_ready', 503],
    ['bot_not_in_guild', 404],
    ['channel_not_found', 409],
    ['role_not_found', 409],
  ] as const)('maps Discord management error %s', async (code, statusCode) => {
    const management = createManagement();
    vi.mocked(management.updateGuild).mockRejectedValueOnce(new DiscordManagementError(code));
    const { server } = await createServer({ management });
    const response = await server.inject({
      method: 'PATCH',
      url: `/api/guilds/${guildId}`,
      headers: authHeaders(true),
      payload: { prefix: '?' },
    });
    await close(server);
    expect(response.statusCode).toBe(statusCode);
    expect(response.json().error.code).toBe(code);
  });

  it('propagates guild persistence failures as stable errors', async () => {
    const management = createManagement();
    vi.mocked(management.updateGuild).mockRejectedValueOnce(new Error('database failed'));
    const { server } = await createServer({ management });
    const response = await server.inject({
      method: 'PATCH',
      url: `/api/guilds/${guildId}`,
      headers: authHeaders(true),
      payload: { prefix: '?' },
    });
    await close(server);
    expect(response.statusCode).toBe(500);
    expect(response.json().error.code).toBe('settings_update_failed');
  });
});
