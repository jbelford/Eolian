import { environment } from '@eolian/common/env';
import { DiscordSessionGuild, DiscordSessionUser } from '@eolian/data/@types';
import { DiscordOAuthClient, DiscordTokenResponse } from '@eolian/webserver/auth/@types';
import {
  CSRF_HEADER,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_DURATION_SECONDS,
} from '@eolian/webserver/auth/constants';
import { registerDiscordAuthRoutes } from '@eolian/webserver/auth/routes';
import { registerSecureSession } from '@eolian/webserver/auth/secure-session';
import fastify, { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@eolian/common/logger', () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

const start = new Date('2026-09-22T08:00:00.000Z');
const user: DiscordSessionUser = {
  id: 'user-1',
  username: 'eolian-user',
  globalName: 'Eolian User',
  avatar: 'avatar',
};
const guilds: DiscordSessionGuild[] = [
  { id: 'guild-1', name: 'Guild', icon: null, owner: true, permissions: '0' },
];
const token: DiscordTokenResponse = {
  accessToken: 'access-token',
  scope: 'identify guilds',
  expiresIn: 604800,
};

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
    getCurrentUser: vi.fn().mockResolvedValue(user),
    getCurrentUserGuilds: vi.fn().mockResolvedValue(guilds),
  };
}

async function createServer(oauthClient = createOAuthClient()) {
  let currentTime = start;
  const server = fastify();
  vi.spyOn(Date, 'now').mockImplementation(() => currentTime.getTime());
  registerSecureSession(server);
  await server.register(registerDiscordAuthRoutes, {
    prefix: '/api/auth',
    oauthClient,
    now: () => currentTime,
  });
  await server.ready();
  return {
    server,
    oauthClient,
    setNow: (value: Date) => {
      currentTime = value;
    },
  };
}

function cookies(response: { headers: Record<string, string | string[] | number | undefined> }) {
  const value = response.headers['set-cookie'];
  return value ? (Array.isArray(value) ? value : [value.toString()]) : [];
}

function cookieValue(
  response: { headers: Record<string, string | string[] | number | undefined> },
  name: string,
) {
  const encoded = cookies(response)
    .find(value => value.startsWith(`${name}=`))
    ?.split(';', 1)[0]
    .slice(name.length + 1);
  return encoded === undefined ? undefined : decodeURIComponent(encoded);
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
  return { response, sessionCookie: cookieValue(response, SESSION_COOKIE)! };
}

function sessionHeaders(cookie: string) {
  return { cookie: `${SESSION_COOKIE}=${encodeURIComponent(cookie)}` };
}

describe('stateless Discord auth routes', () => {
  beforeEach(() => {
    environment.prod = false;
  });

  it('redirects with only identify and guilds and a signed, scoped state cookie', async () => {
    const { server } = await createServer();
    const { response } = await beginLogin(server);
    await server.close();

    const location = new URL(response.headers.location!);
    expect(response.statusCode).toBe(302);
    expect(location.origin + location.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(location.searchParams.get('scope')).toBe('identify guilds');
    expect(location.searchParams.get('response_type')).toBe('code');
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

  it('rejects absent, mismatched, and expired OAuth state', async () => {
    const auth = await createServer();
    const started = await beginLogin(auth.server);
    const missing = await auth.server.inject({
      method: 'GET',
      url: '/api/auth/discord/callback?code=code',
    });
    const mismatched = await auth.server.inject({
      method: 'GET',
      url: '/api/auth/discord/callback?state=wrong&code=code',
      headers: { cookie: `${OAUTH_STATE_COOKIE}=${started.stateCookie}` },
    });
    auth.setNow(new Date(start.getTime() + 11 * 60 * 1000));
    const expired = await auth.server.inject({
      method: 'GET',
      url: `/api/auth/discord/callback?state=${started.state}&code=code`,
      headers: { cookie: `${OAUTH_STATE_COOKIE}=${started.stateCookie}` },
    });
    await auth.server.close();
    expect(missing.statusCode).toBe(400);
    expect(mismatched.json().error.code).toBe('invalid_oauth_state');
    expect(expired.json().error.code).toBe('invalid_oauth_state');
    expect(auth.oauthClient.exchangeCode).not.toHaveBeenCalled();
  });

  it('reports denial and missing code without exchanging credentials', async () => {
    const auth = await createServer();
    const started = await beginLogin(auth.server);
    const headers = { cookie: `${OAUTH_STATE_COOKIE}=${started.stateCookie}` };
    const denied = await auth.server.inject({
      method: 'GET',
      url: `/api/auth/discord/callback?state=${started.state}&error=access_denied`,
      headers,
    });
    const missing = await auth.server.inject({
      method: 'GET',
      url: `/api/auth/discord/callback?state=${started.state}`,
      headers,
    });
    await auth.server.close();
    expect(denied.json().error.code).toBe('oauth_denied');
    expect(missing.json().error.code).toBe('missing_oauth_code');
    expect(auth.oauthClient.exchangeCode).not.toHaveBeenCalled();
  });

  it('issues a fresh encrypted cookie, keeps the safe return path, and limits its size', async () => {
    const auth = await createServer();
    const { response, sessionCookie } = await login(auth.server, '/settings?tab=guilds');
    await auth.server.close();

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('/settings?tab=guilds');
    expect(sessionCookie).toMatch(/^[A-Za-z0-9+/=]+;[A-Za-z0-9+/=]+$/);
    expect(sessionCookie).not.toContain(token.accessToken);
    expect(cookies(response).map(value => value.split('=', 1)[0])).toEqual([
      OAUTH_STATE_COOKIE,
      SESSION_COOKIE,
    ]);
    const cookieHeader = cookies(response).find(value => value.startsWith(`${SESSION_COOKIE}=`))!;
    expect(Buffer.byteLength(cookieHeader, 'utf8')).toBeLessThanOrEqual(4096);
    expect(cookieHeader).toContain('Path=/');
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('SameSite=Lax');
    expect(cookieHeader).toContain(`Max-Age=${SESSION_DURATION_SECONDS}`);
    expect(auth.oauthClient.getCurrentUserGuilds).not.toHaveBeenCalled();
  });

  it('sets Secure on production cookies', async () => {
    environment.prod = true;
    const auth = await createServer();
    const { response } = await login(auth.server);
    await auth.server.close();
    expect(cookies(response).find(value => value.startsWith(`${SESSION_COOKIE}=`))).toContain(
      'Secure',
    );
  });

  it('enforces the library default lifetime without renewal on repeated requests', async () => {
    const auth = await createServer();
    const { sessionCookie } = await login(auth.server);
    const expiresAt = new Date(start.getTime() + SESSION_DURATION_SECONDS * 1000).toISOString();
    auth.setNow(new Date(start.getTime() + SESSION_DURATION_SECONDS * 1000 - 1));
    const beforeExpiry = await auth.server.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: sessionHeaders(sessionCookie),
    });
    const repeated = await auth.server.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: sessionHeaders(sessionCookie),
    });
    auth.setNow(new Date(start.getTime() + SESSION_DURATION_SECONDS * 1000));
    const expired = await auth.server.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: sessionHeaders(sessionCookie),
    });
    await auth.server.close();

    expect(beforeExpiry.json()).toEqual({
      authenticated: true,
      user,
      guilds,
      csrfToken: expect.any(String),
      expiresAt,
    });
    expect(repeated.json().expiresAt).toBe(expiresAt);
    expect(cookies(beforeExpiry)).toHaveLength(0);
    expect(cookies(repeated)).toHaveLength(0);
    expect(expired.json()).toEqual({ authenticated: false });
    expect(cookies(expired)[0]).toContain('Max-Age=0');
    expect(auth.oauthClient.getCurrentUserGuilds).toHaveBeenCalledTimes(2);
  });

  it('uses fresh manageable-guild claims without storing the guild list in the cookie', async () => {
    const auth = await createServer();
    const { sessionCookie } = await login(auth.server);
    const manyGuilds = Array.from({ length: 250 }, (_, index) => ({
      ...guilds[0],
      id: `${index + 1}`,
    }));
    vi.mocked(auth.oauthClient.getCurrentUserGuilds).mockResolvedValue(manyGuilds);
    const response = await auth.server.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: sessionHeaders(sessionCookie),
    });
    await auth.server.close();
    expect(response.json().guilds).toHaveLength(250);
    expect(sessionCookie.length).toBeLessThan(4096);
    expect(response.body).not.toContain('access-token');
    expect(auth.oauthClient.getCurrentUserGuilds).toHaveBeenCalledOnce();
  });

  it('accepts a session cookie on another server instance without shared storage', async () => {
    const first = await createServer();
    const { sessionCookie } = await login(first.server);
    await first.server.close();

    const second = await createServer();
    const response = await second.server.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: sessionHeaders(sessionCookie),
    });
    await second.server.close();

    expect(response.json()).toMatchObject({ authenticated: true, user, guilds });
  });

  it('rejects tampered session cookies without calling Discord', async () => {
    const auth = await createServer();
    const { sessionCookie } = await login(auth.server);
    const tampered = `${sessionCookie[0] === 'A' ? 'B' : 'A'}${sessionCookie.slice(1)}`;
    vi.mocked(auth.oauthClient.getCurrentUserGuilds).mockClear();
    const response = await auth.server.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: sessionHeaders(tampered),
    });
    await auth.server.close();
    expect(response.json()).toEqual({ authenticated: false });
    expect(auth.oauthClient.getCurrentUserGuilds).not.toHaveBeenCalled();
  });

  it.each(['exchangeCode', 'getCurrentUser'] as const)(
    'returns a sanitized callback failure when %s fails',
    async method => {
      const oauthClient = createOAuthClient();
      vi.mocked(oauthClient[method]).mockRejectedValue(new Error('private provider response'));
      const auth = await createServer(oauthClient);
      const started = await beginLogin(auth.server);
      const response = await auth.server.inject({
        method: 'GET',
        url: `/api/auth/discord/callback?state=${started.state}&code=bad`,
        headers: { cookie: `${OAUTH_STATE_COOKIE}=${started.stateCookie}` },
      });
      await auth.server.close();
      expect(response.statusCode).toBe(502);
      expect(response.json().error.code).toBe('discord_oauth_failed');
      expect(response.body).not.toContain('private provider response');
      expect(cookieValue(response, SESSION_COOKIE)).toBeUndefined();
    },
  );

  it('rejects tokens shorter than the library default and oversized cookies without truncation', async () => {
    const shortClient = createOAuthClient();
    vi.mocked(shortClient.exchangeCode).mockResolvedValue({
      ...token,
      expiresIn: SESSION_DURATION_SECONDS - 1,
    });
    const shortAuth = await createServer(shortClient);
    const short = (await login(shortAuth.server)).response;
    await shortAuth.server.close();

    const largeClient = createOAuthClient();
    vi.mocked(largeClient.exchangeCode).mockResolvedValue({
      ...token,
      accessToken: 'x'.repeat(4000),
    });
    const largeAuth = await createServer(largeClient);
    const large = (await login(largeAuth.server)).response;
    await largeAuth.server.close();

    for (const response of [short, large]) {
      expect(response.statusCode).toBe(502);
      expect(response.json().error.code).toBe('discord_oauth_failed');
      expect(cookieValue(response, SESSION_COOKIE)).toBeUndefined();
    }
  });

  it('returns a retryable failure without exposing provider details when guild lookup fails', async () => {
    const auth = await createServer();
    const { sessionCookie } = await login(auth.server);
    vi.mocked(auth.oauthClient.getCurrentUserGuilds).mockRejectedValueOnce(
      new Error('private provider response'),
    );
    const failed = await auth.server.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: sessionHeaders(sessionCookie),
    });
    const retried = await auth.server.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: sessionHeaders(sessionCookie),
    });
    await auth.server.close();
    expect(failed.statusCode).toBe(502);
    expect(failed.json().error.code).toBe('session_refresh_failed');
    expect(failed.body).not.toContain('private provider response');
    expect(retried.json().authenticated).toBe(true);
  });

  it('validates origin and CSRF on logout, then only clears the browser cookie', async () => {
    const auth = await createServer();
    const { sessionCookie } = await login(auth.server);
    const session = await auth.server.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: sessionHeaders(sessionCookie),
    });
    const csrf = session.json().csrfToken;
    const badOrigin = await auth.server.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        ...sessionHeaders(sessionCookie),
        origin: 'https://evil.example',
        [CSRF_HEADER]: csrf,
      },
    });
    const badCsrf = await auth.server.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        ...sessionHeaders(sessionCookie),
        origin: 'http://localhost:8080',
        [CSRF_HEADER]: 'wrong',
      },
    });
    vi.mocked(auth.oauthClient.getCurrentUserGuilds).mockClear();
    const logout = await auth.server.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        ...sessionHeaders(sessionCookie),
        origin: 'http://localhost:8080',
        [CSRF_HEADER]: csrf,
      },
    });
    const copiedCookie = await auth.server.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: sessionHeaders(sessionCookie),
    });
    await auth.server.close();
    expect(badOrigin.json().error.code).toBe('invalid_origin');
    expect(badCsrf.json().error.code).toBe('invalid_csrf');
    expect(logout.statusCode).toBe(204);
    expect(cookies(logout)[0]).toContain('Max-Age=0');
    expect(auth.oauthClient.getCurrentUserGuilds).toHaveBeenCalledOnce();
    expect(copiedCookie.json().authenticated).toBe(true);
  });

  it('rejects expired cookies for logout even when the caller supplies CSRF', async () => {
    const auth = await createServer();
    const { sessionCookie } = await login(auth.server);
    const response = await auth.server.inject({
      method: 'GET',
      url: '/api/auth/session',
      headers: sessionHeaders(sessionCookie),
    });
    auth.setNow(new Date(start.getTime() + SESSION_DURATION_SECONDS * 1000));
    const logout = await auth.server.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: {
        ...sessionHeaders(sessionCookie),
        origin: 'http://localhost:8080',
        [CSRF_HEADER]: response.json().csrfToken,
      },
    });
    await auth.server.close();
    expect(logout.statusCode).toBe(401);
    expect(logout.json().error.code).toBe('unauthenticated');
  });
});
