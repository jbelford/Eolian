import { environment } from '@eolian/common/env';
import {
  DiscordSessionGuild,
  DiscordSessionUser,
  SessionDTO,
  SessionsDb,
} from '@eolian/data/@types';
import { FastifyInstance } from 'fastify';
import fastify from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DiscordOAuthClient, DiscordTokenResponse } from '@eolian/webserver/auth/@types';
import {
  CSRF_HEADER,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_DURATION_MS,
} from '@eolian/webserver/auth/constants';
import { sessionKey } from '@eolian/webserver/auth/crypto';
import { registerDiscordAuthRoutes } from '@eolian/webserver/auth/routes';

vi.mock('@eolian/common/logger', () => ({
  logger: { warn: vi.fn() },
}));

const user: DiscordSessionUser = {
  id: 'user-1',
  username: 'eolian-user',
  globalName: 'Eolian User',
  avatar: 'avatar',
};
const guilds: DiscordSessionGuild[] = [
  {
    id: 'guild-1',
    name: 'Guild',
    icon: null,
    owner: true,
    permissions: '0',
  },
];
const token: DiscordTokenResponse = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  scope: 'identify guilds',
  expiresIn: 3600,
};

class MemorySessions implements SessionsDb {
  readonly records = new Map<string, SessionDTO>();
  readonly initialize = vi.fn(async () => undefined);
  readonly create = vi.fn(async (session: SessionDTO) => {
    this.records.set(session._id, structuredClone(session));
  });
  readonly get = vi.fn(async (id: string) => {
    const record = this.records.get(id);
    return record ? structuredClone(record) : null;
  });
  readonly delete = vi.fn(async (id: string) => this.records.delete(id));
  readonly update = vi.fn(async (id: string, values: Partial<Omit<SessionDTO, '_id'>>) => {
    const record = this.records.get(id);
    if (!record) {
      return false;
    }
    Object.assign(record, structuredClone(values));
    return true;
  });
  readonly renew = vi.fn(
    async (id: string, renewedBefore: Date, renewedAt: Date, expiresAt: Date) => {
      const record = this.records.get(id);
      if (
        !record ||
        record.renewedAt.getTime() > renewedBefore.getTime() ||
        record.expiresAt.getTime() <= renewedAt.getTime()
      ) {
        return false;
      }
      record.renewedAt = renewedAt;
      record.expiresAt = expiresAt;
      return true;
    },
  );
}

function createOAuthClient(): DiscordOAuthClient {
  return {
    authorizationUrl: vi.fn(
      state =>
        `https://discord.com/oauth2/authorize?${new URLSearchParams({
          response_type: 'code',
          client_id: 'client',
          redirect_uri: 'http://localhost:8080/api/auth/discord/callback',
          scope: 'identify guilds',
          state,
        })}`,
    ),
    exchangeCode: vi.fn().mockResolvedValue(token),
    refreshToken: vi.fn().mockResolvedValue({
      ...token,
      accessToken: 'refreshed-access-token',
      refreshToken: 'refreshed-refresh-token',
    }),
    getCurrentUser: vi.fn().mockResolvedValue(user),
    getCurrentUserGuilds: vi.fn().mockResolvedValue(guilds),
  };
}

async function createServer(
  sessions = new MemorySessions(),
  oauthClient = createOAuthClient(),
  now = new Date('2026-09-22T08:00:00.000Z'),
): Promise<{
  server: FastifyInstance;
  sessions: MemorySessions;
  oauthClient: DiscordOAuthClient;
  setNow: (value: Date) => void;
}> {
  let currentTime = now;
  const server = fastify();
  await server.register(registerDiscordAuthRoutes, {
    prefix: '/api/auth',
    sessions,
    oauthClient,
    now: () => currentTime,
  });
  await server.ready();
  return {
    server,
    sessions,
    oauthClient,
    setNow: value => {
      currentTime = value;
    },
  };
}

function cookies(response: {
  headers: Record<string, string | string[] | number | undefined>;
}): string[] {
  const value = response.headers['set-cookie'];
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value.toString()];
}

function cookieValue(
  response: { headers: Record<string, string | string[] | number | undefined> },
  name: string,
) {
  const cookie = cookies(response).find(value => value.startsWith(`${name}=`));
  return cookie?.split(';', 1)[0].slice(name.length + 1);
}

async function beginLogin(server: FastifyInstance, returnTo = '/settings') {
  const response = await server.inject({
    method: 'GET',
    url: `/api/auth/discord?returnTo=${encodeURIComponent(returnTo)}`,
  });
  const location = new URL(response.headers.location!);
  return {
    response,
    state: location.searchParams.get('state')!,
    stateCookie: cookieValue(response, OAUTH_STATE_COOKIE)!,
  };
}

async function login(server: FastifyInstance, returnTo = '/settings') {
  const started = await beginLogin(server, returnTo);
  const response = await server.inject({
    method: 'GET',
    url: `/api/auth/discord/callback?state=${started.state}&code=oauth-code`,
    headers: { cookie: `${OAUTH_STATE_COOKIE}=${started.stateCookie}` },
  });
  return {
    response,
    sessionCookie: cookieValue(response, SESSION_COOKIE)!,
  };
}

describe('Discord auth routes', () => {
  beforeEach(() => {
    environment.prod = false;
  });

  it('redirects to Discord with only identify and guilds and a signed state cookie', async () => {
    const { server } = await createServer();

    const { response } = await beginLogin(server);
    const location = new URL(response.headers.location!);
    await server.close();

    expect(response.statusCode).toBe(302);
    expect(location.origin + location.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('scope')).toBe('identify guilds');
    expect(location.searchParams.get('state')).toBeTruthy();
    expect(cookies(response)[0]).toContain('HttpOnly');
    expect(cookies(response)[0]).toContain('SameSite=Lax');
    expect(cookies(response)[0]).toContain('Path=/api/auth');
  });

  it.each(['https://evil.example/path', '//evil.example/path', '/\\evil'])(
    'rejects unsafe return path %s',
    async returnTo => {
      const { server } = await createServer();
      const response = await server.inject({
        method: 'GET',
        url: `/api/auth/discord?returnTo=${encodeURIComponent(returnTo)}`,
      });
      await server.close();

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('invalid_return_path');
    },
  );

  it('rejects missing, mismatched, and expired OAuth state', async () => {
    const { server, setNow } = await createServer();
    const started = await beginLogin(server);

    const missing = await server.inject({
      method: 'GET',
      url: '/api/auth/discord/callback?code=code',
    });
    const mismatched = await server.inject({
      method: 'GET',
      url: '/api/auth/discord/callback?state=wrong&code=code',
      headers: { cookie: `${OAUTH_STATE_COOKIE}=${started.stateCookie}` },
    });
    setNow(new Date('2026-09-22T08:11:00.000Z'));
    const expired = await server.inject({
      method: 'GET',
      url: `/api/auth/discord/callback?state=${started.state}&code=code`,
      headers: { cookie: `${OAUTH_STATE_COOKIE}=${started.stateCookie}` },
    });
    await server.close();

    expect(missing.statusCode).toBe(400);
    expect(mismatched.json().error.code).toBe('invalid_oauth_state');
    expect(expired.json().error.code).toBe('invalid_oauth_state');
  });

  it('handles denial and missing authorization codes explicitly', async () => {
    const deniedServer = await createServer();
    const deniedLogin = await beginLogin(deniedServer.server);
    const denied = await deniedServer.server.inject({
      method: 'GET',
      url: `/api/auth/discord/callback?state=${deniedLogin.state}&error=access_denied`,
      headers: { cookie: `${OAUTH_STATE_COOKIE}=${deniedLogin.stateCookie}` },
    });
    await deniedServer.server.close();

    const missingServer = await createServer();
    const missingLogin = await beginLogin(missingServer.server);
    const missing = await missingServer.server.inject({
      method: 'GET',
      url: `/api/auth/discord/callback?state=${missingLogin.state}`,
      headers: { cookie: `${OAUTH_STATE_COOKIE}=${missingLogin.stateCookie}` },
    });
    await missingServer.server.close();

    expect(denied.json().error.code).toBe('oauth_denied');
    expect(missing.json().error.code).toBe('missing_oauth_code');
  });

  it('creates a rotated persistent session and redirects only to the retained path', async () => {
    const { server, sessions } = await createServer();
    const oldRawId = 'old-session';
    sessions.records.set(sessionKey(oldRawId, environment.sessionSecret), {
      _id: sessionKey(oldRawId, environment.sessionSecret),
      user,
      tokens: { ...token, expiresAt: new Date('2026-09-22T09:00:00.000Z') } as never,
      guilds,
      guildsRefreshedAt: new Date('2026-09-22T08:00:00.000Z'),
      csrfToken: 'old-csrf',
      createdAt: new Date('2026-09-22T08:00:00.000Z'),
      renewedAt: new Date('2026-09-22T08:00:00.000Z'),
      expiresAt: new Date('2026-09-29T08:00:00.000Z'),
    });
    const started = await beginLogin(server, '/settings?tab=guilds');

    const response = await server.inject({
      method: 'GET',
      url: `/api/auth/discord/callback?state=${started.state}&code=oauth-code`,
      headers: {
        cookie: `${OAUTH_STATE_COOKIE}=${started.stateCookie}; ${SESSION_COOKIE}=${oldRawId}`,
      },
    });
    const sessionCookie = cookieValue(response, SESSION_COOKIE)!;
    await server.close();

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/settings?tab=guilds');
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie).not.toBe(oldRawId);
    expect(sessions.delete).toHaveBeenCalledWith(sessionKey(oldRawId, environment.sessionSecret));
    const stored = [...sessions.records.values()][0];
    expect(stored._id).not.toBe(sessionCookie);
    expect(stored.tokens.accessToken).toBe('access-token');
    expect(stored.csrfToken).toBeTruthy();
  });

  it.each(['exchangeCode', 'getCurrentUser', 'getCurrentUserGuilds'] as const)(
    'returns a generic callback failure when %s fails',
    async method => {
      const oauthClient = createOAuthClient();
      vi.mocked(oauthClient[method]).mockRejectedValue(new Error('provider token body'));
      const { server } = await createServer(new MemorySessions(), oauthClient);
      const started = await beginLogin(server);

      const response = await server.inject({
        method: 'GET',
        url: `/api/auth/discord/callback?state=${started.state}&code=bad`,
        headers: { cookie: `${OAUTH_STATE_COOKIE}=${started.stateCookie}` },
      });
      await server.close();

      expect(response.statusCode).toBe(502);
      expect(response.body).not.toContain('provider token body');
      expect(response.json().error.code).toBe('discord_oauth_failed');
    },
  );

  it('sets the production session cookie security attributes', async () => {
    environment.prod = true;
    const { server } = await createServer();

    const { response } = await login(server);
    const sessionHeader = cookies(response).find(value => value.startsWith(`${SESSION_COOKIE}=`))!;
    await server.close();

    expect(sessionHeader).toContain('Secure');
    expect(sessionHeader).toContain('HttpOnly');
    expect(sessionHeader).toContain('SameSite=Lax');
    expect(sessionHeader).toContain('Path=/');
    expect(sessionHeader).toContain(`Max-Age=${SESSION_DURATION_MS / 1000}`);
  });

  it('returns only sanitized session data and renews expiry at most once per day', async () => {
    const auth = await createServer();
    const loggedIn = await login(auth.server);
    const key = sessionKey(loggedIn.sessionCookie, environment.sessionSecret);
    const record = auth.sessions.records.get(key)!;
    record.renewedAt = new Date('2026-09-20T08:00:00.000Z');

    const response = await auth.server.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: `${SESSION_COOKIE}=${loggedIn.sessionCookie}` },
    });
    const second = await auth.server.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: `${SESSION_COOKIE}=${loggedIn.sessionCookie}` },
    });
    await auth.server.close();

    const body = response.json();
    expect(body).toEqual({
      authenticated: true,
      user,
      guilds,
      csrfToken: record.csrfToken,
      expiresAt: new Date('2026-09-29T08:00:00.000Z').toISOString(),
    });
    expect(response.body).not.toContain('access-token');
    expect(response.body).not.toContain('refresh-token');
    expect(auth.sessions.renew).toHaveBeenCalledTimes(2);
    expect(cookies(response).some(value => value.startsWith(`${SESSION_COOKIE}=`))).toBe(true);
    expect(cookies(second)).toHaveLength(0);
  });

  it('refreshes expired Discord tokens and stale manageable guild claims', async () => {
    const auth = await createServer();
    const loggedIn = await login(auth.server);
    const key = sessionKey(loggedIn.sessionCookie, environment.sessionSecret);
    const record = auth.sessions.records.get(key)!;
    record.tokens.expiresAt = new Date('2026-09-22T08:00:30.000Z');
    record.guildsRefreshedAt = new Date('2026-09-22T07:00:00.000Z');
    const refreshedGuilds = [{ ...guilds[0], id: 'guild-2' }];
    vi.mocked(auth.oauthClient.getCurrentUserGuilds).mockResolvedValue(refreshedGuilds);

    const response = await auth.server.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: `${SESSION_COOKIE}=${loggedIn.sessionCookie}` },
    });
    await auth.server.close();

    expect(response.statusCode).toBe(200);
    expect(auth.oauthClient.refreshToken).toHaveBeenCalledWith('refresh-token');
    expect(auth.oauthClient.getCurrentUserGuilds).toHaveBeenCalledWith('refreshed-access-token');
    expect(response.json().guilds).toEqual(refreshedGuilds);
    expect(auth.sessions.update).toHaveBeenCalled();
  });

  it('removes expired sessions and clears their cookie', async () => {
    const auth = await createServer();
    const loggedIn = await login(auth.server);
    const key = sessionKey(loggedIn.sessionCookie, environment.sessionSecret);
    auth.sessions.records.get(key)!.expiresAt = new Date('2026-09-22T07:59:59.000Z');

    const response = await auth.server.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: { cookie: `${SESSION_COOKIE}=${loggedIn.sessionCookie}` },
    });
    await auth.server.close();

    expect(response.json()).toEqual({ authenticated: false });
    expect(auth.sessions.delete).toHaveBeenCalledWith(key);
    expect(cookies(response)[0]).toContain('Max-Age=0');
  });

  it('rejects logout without same-origin and matching CSRF headers', async () => {
    const auth = await createServer();
    const loggedIn = await login(auth.server);
    const record = [...auth.sessions.records.values()][0];

    const badOrigin = await auth.server.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        cookie: `${SESSION_COOKIE}=${loggedIn.sessionCookie}`,
        origin: 'https://evil.example',
        [CSRF_HEADER]: record.csrfToken,
      },
    });
    const badCsrf = await auth.server.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        cookie: `${SESSION_COOKIE}=${loggedIn.sessionCookie}`,
        origin: 'http://localhost:8080',
        [CSRF_HEADER]: 'wrong',
      },
    });
    await auth.server.close();

    expect(badOrigin.statusCode).toBe(403);
    expect(badOrigin.json().error.code).toBe('invalid_origin');
    expect(badCsrf.statusCode).toBe(403);
    expect(badCsrf.json().error.code).toBe('invalid_csrf');
  });

  it('logs out, deletes the session, and expires the cookie', async () => {
    const auth = await createServer();
    const loggedIn = await login(auth.server);
    const key = sessionKey(loggedIn.sessionCookie, environment.sessionSecret);
    const record = auth.sessions.records.get(key)!;

    const response = await auth.server.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        cookie: `${SESSION_COOKIE}=${loggedIn.sessionCookie}`,
        origin: 'http://localhost:8080',
        [CSRF_HEADER]: record.csrfToken,
      },
    });
    await auth.server.close();

    expect(response.statusCode).toBe(204);
    expect(auth.sessions.records.has(key)).toBe(false);
    expect(cookies(response).at(-1)).toContain(`${SESSION_COOKIE}=`);
    expect(cookies(response).at(-1)).toContain('Max-Age=0');
  });
});
