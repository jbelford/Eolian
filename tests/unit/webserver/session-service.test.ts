import { environment } from '@eolian/common/env';
import { SessionDTO, SessionsDb } from '@eolian/data/@types';
import { DiscordOAuthClient, DiscordTokenResponse } from '@eolian/webserver/auth/@types';
import { sessionKey } from '@eolian/webserver/auth/crypto';
import { PersistentAuthSessionService } from '@eolian/webserver/auth/session-service';
import { describe, expect, it, vi } from 'vitest';

const now = new Date('2026-09-22T08:00:00.000Z');
const rawId = 'raw-session-id';

function session(): SessionDTO {
  return {
    _id: sessionKey(rawId, environment.sessionSecret),
    user: {
      id: 'user',
      username: 'user',
      globalName: null,
      avatar: null,
    },
    tokens: {
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
      scope: 'identify guilds',
      expiresAt: new Date('2026-09-22T08:00:30.000Z'),
    },
    guilds: [],
    guildsRefreshedAt: new Date('2026-09-22T07:00:00.000Z'),
    csrfToken: 'csrf',
    createdAt: new Date('2026-09-22T07:00:00.000Z'),
    renewedAt: new Date('2026-09-22T08:00:00.000Z'),
    expiresAt: new Date('2026-09-29T08:00:00.000Z'),
  };
}

function createStore(initial: SessionDTO | null) {
  let record = initial;
  const store: SessionsDb = {
    initialize: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(async value => {
      record = structuredClone(value);
    }),
    get: vi.fn(async () => (record ? structuredClone(record) : null)),
    update: vi.fn(async (_id, values) => {
      if (!record) {
        return false;
      }
      Object.assign(record, structuredClone(values));
      return true;
    }),
    renew: vi.fn().mockResolvedValue(false),
    delete: vi.fn(async () => {
      const existed = !!record;
      record = null;
      return existed;
    }),
  };
  return {
    store,
    set: (value: SessionDTO) => {
      record = value;
    },
  };
}

function createOAuthClient(): DiscordOAuthClient {
  return {
    authorizationUrl: vi.fn(),
    exchangeCode: vi.fn(),
    refreshToken: vi.fn(),
    getCurrentUser: vi.fn(),
    getCurrentUserGuilds: vi.fn().mockResolvedValue([
      {
        id: 'guild',
        name: 'Guild',
        icon: null,
        owner: true,
        permissions: '0',
      },
    ]),
  };
}

function refreshedToken(): DiscordTokenResponse {
  return {
    accessToken: 'new-access',
    refreshToken: 'new-refresh',
    scope: 'identify guilds',
    expiresIn: 3600,
  };
}

describe('PersistentAuthSessionService refresh single-flight', () => {
  it('shares one successful token and claim refresh across concurrent resolves', async () => {
    let completeRefresh!: (value: DiscordTokenResponse) => void;
    const refresh = new Promise<DiscordTokenResponse>(resolve => {
      completeRefresh = resolve;
    });
    const database = createStore(session());
    const oauthClient = createOAuthClient();
    vi.mocked(oauthClient.refreshToken).mockReturnValue(refresh);
    const service = new PersistentAuthSessionService(database.store, oauthClient, () => now);

    const first = service.resolve(rawId);
    await vi.waitFor(() => expect(oauthClient.refreshToken).toHaveBeenCalledOnce());
    const second = service.resolve(rawId);
    await Promise.resolve();
    completeRefresh(refreshedToken());

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(oauthClient.refreshToken).toHaveBeenCalledOnce();
    expect(oauthClient.getCurrentUserGuilds).toHaveBeenCalledOnce();
    expect(database.store.update).toHaveBeenCalledOnce();
    expect(database.store.delete).not.toHaveBeenCalled();
    expect(firstResult?.record.tokens.refreshToken).toBe('new-refresh');
    expect(secondResult?.record.tokens.refreshToken).toBe('new-refresh');
  });

  it('shares refresh failure, deletes once, and clears the flight for a later attempt', async () => {
    let failRefresh!: (error: Error) => void;
    const refresh = new Promise<DiscordTokenResponse>((_resolve, reject) => {
      failRefresh = reject;
    });
    const database = createStore(session());
    const oauthClient = createOAuthClient();
    vi.mocked(oauthClient.refreshToken).mockReturnValueOnce(refresh);
    const service = new PersistentAuthSessionService(database.store, oauthClient, () => now);

    const first = service.resolve(rawId);
    await vi.waitFor(() => expect(oauthClient.refreshToken).toHaveBeenCalledOnce());
    const second = service.resolve(rawId);
    await Promise.resolve();
    failRefresh(new Error('rotated token rejected'));

    const results = await Promise.allSettled([first, second]);

    expect(results.map(result => result.status)).toEqual(['rejected', 'rejected']);
    expect(oauthClient.refreshToken).toHaveBeenCalledOnce();
    expect(database.store.delete).toHaveBeenCalledOnce();

    database.set(session());
    vi.mocked(oauthClient.refreshToken).mockResolvedValueOnce(refreshedToken());
    await expect(service.resolve(rawId)).resolves.not.toBeNull();
    expect(oauthClient.refreshToken).toHaveBeenCalledTimes(2);
  });
});
