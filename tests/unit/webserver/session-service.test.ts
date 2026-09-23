import { environment } from '@eolian/common/env';
import { DiscordSessionUser } from '@eolian/data/@types';
import { DiscordOAuthClient, DiscordTokenResponse } from '@eolian/webserver/auth/@types';
import { SESSION_DURATION_SECONDS } from '@eolian/webserver/auth/constants';
import { registerSecureSession } from '@eolian/webserver/auth/secure-session';
import { StatelessAuthSessionService } from '@eolian/webserver/auth/session-service';
import fastify, { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const issuedAt = new Date('2026-09-22T08:00:00.000Z');
const token: DiscordTokenResponse = {
  accessToken: 'private-access-token',
  scope: 'identify guilds',
  expiresIn: 604800,
};
const user: DiscordSessionUser = {
  id: 'user-1',
  username: 'user',
  globalName: null,
  avatar: null,
};
const guilds = [{ id: '1', name: 'Guild', icon: null, owner: true, permissions: '0' }];

function oauthClient(): DiscordOAuthClient {
  return {
    authorizationUrl: vi.fn(),
    exchangeCode: vi.fn(),
    getCurrentUser: vi.fn(),
    getCurrentUserGuilds: vi.fn().mockResolvedValue(guilds),
  };
}

describe('StatelessAuthSessionService', () => {
  const server: FastifyInstance = fastify();
  let currentTime = issuedAt;

  beforeAll(async () => {
    registerSecureSession(server);
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    currentTime = issuedAt;
    vi.spyOn(Date, 'now').mockImplementation(() => currentTime.getTime());
  });

  function service(client = oauthClient()) {
    return new StatelessAuthSessionService(server, client, () => currentTime);
  }

  it('seals a library-default cookie without embedding readable credentials', async () => {
    const client = oauthClient();
    const auth = service(client);
    const { cookie, expiresAt } = auth.create(token, user, issuedAt);
    const resolved = await auth.resolve(cookie);

    expect(cookie).toMatch(/^[A-Za-z0-9+/=]+;[A-Za-z0-9+/=]+$/);
    expect(cookie).not.toContain(token.accessToken);
    expect(cookie).not.toContain('refresh');
    expect(resolved).toMatchObject({
      id: cookie,
      record: {
        user,
        guilds,
        csrfToken: expect.any(String),
        expiresAt: new Date(issuedAt.getTime() + SESSION_DURATION_SECONDS * 1000),
      },
    });
    expect(resolved?.record.expiresAt).toEqual(expiresAt);
    expect(JSON.stringify(resolved)).not.toContain(token.accessToken);
    expect(client.getCurrentUserGuilds).toHaveBeenCalledWith(token.accessToken);
  });

  it('uses the library default deadline and never extends on repeated resolves', async () => {
    const client = oauthClient();
    const auth = service(client);
    const { cookie, expiresAt } = auth.create(token, user, issuedAt);
    currentTime = new Date(expiresAt.getTime() - 1);
    const first = await auth.resolve(cookie);
    const second = await auth.resolve(cookie);
    currentTime = expiresAt;

    expect(first?.record.expiresAt).toEqual(second?.record.expiresAt);
    await expect(auth.resolve(cookie)).resolves.toBeNull();
    await expect(auth.resolveForLogout(cookie)).resolves.toBeNull();
    expect(client.getCurrentUserGuilds).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed or tampered cookies without contacting Discord', async () => {
    const client = oauthClient();
    const auth = service(client);
    const { cookie } = auth.create(token, user, issuedAt);
    const tampered = `${cookie[0] === 'A' ? 'B' : 'A'}${cookie.slice(1)}`;
    await expect(auth.resolve(tampered)).resolves.toBeNull();
    await expect(auth.resolve('invalid')).resolves.toBeNull();
    await expect(auth.resolve(cookie.repeat(20))).resolves.toBeNull();
    expect(client.getCurrentUserGuilds).not.toHaveBeenCalled();
  });

  it('does not require Discord to validate logout, and logout does not revoke copied cookies', async () => {
    const client = oauthClient();
    const auth = service(client);
    const { cookie } = auth.create(token, user, issuedAt);
    const logoutSession = await auth.resolveForLogout(cookie);
    const copiedSession = await auth.resolve(cookie);
    expect(logoutSession?.record.guilds).toEqual([]);
    expect(copiedSession?.record.user).toEqual(user);
    expect(client.getCurrentUserGuilds).toHaveBeenCalledOnce();
  });

  it('rejects provider tokens too short for the library default rather than shortening it', () => {
    const auth = service();
    expect(() =>
      auth.create({ ...token, expiresIn: SESSION_DURATION_SECONDS - 1 }, user, issuedAt),
    ).toThrow('Discord access token cannot support the session lifetime');
    expect(() => auth.create({ ...token, expiresIn: Number.NaN }, user, issuedAt)).toThrow(
      'Discord access token cannot support the session lifetime',
    );
  });

  it('does not expose claims when Discord guild lookup fails', async () => {
    const client = oauthClient();
    const error = new Error('provider unavailable');
    vi.mocked(client.getCurrentUserGuilds).mockRejectedValueOnce(error);
    const auth = service(client);
    const { cookie } = auth.create(token, user, issuedAt);
    await expect(auth.resolve(cookie)).rejects.toBe(error);
    await expect(auth.resolve(cookie)).resolves.toMatchObject({
      record: { guilds },
    });
  });

  it('rejects a cookie encrypted with a different SESSION_SECRET', async () => {
    const oldSecret = environment.sessionSecret;
    const { cookie } = service().create(token, user, issuedAt);
    const otherServer = fastify();
    try {
      environment.sessionSecret = 'different-test-session-secret-at-least-32-bytes';
      registerSecureSession(otherServer);
      await otherServer.ready();
      const other = new StatelessAuthSessionService(otherServer, oauthClient(), () => currentTime);
      await expect(other.resolve(cookie)).resolves.toBeNull();
    } finally {
      await otherServer.close();
      environment.sessionSecret = oldSecret;
    }
  });
});
