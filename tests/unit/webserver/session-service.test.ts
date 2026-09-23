import { environment } from '@eolian/common/env';
import { SessionDTO, SessionsDb } from '@eolian/data/@types';
import { DiscordOAuthClient, DiscordTokenResponse } from '@eolian/webserver/auth/@types';
import { sessionKey } from '@eolian/webserver/auth/crypto';
import {
  PersistentAuthSessionService,
  SessionReauthenticationRequiredError,
} from '@eolian/webserver/auth/session-service';
import { describe, expect, it, vi } from 'vitest';

const logs = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock('@eolian/common/logger', () => ({ logger: logs }));

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
    read: () => (record ? structuredClone(record) : null),
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
    expect(database.store.update).toHaveBeenCalledTimes(2);
    expect(vi.mocked(database.store.update).mock.calls).toEqual([
      [
        sessionKey(rawId, environment.sessionSecret),
        {
          tokens: expect.objectContaining({ refreshToken: 'new-refresh' }),
        },
      ],
      [
        sessionKey(rawId, environment.sessionSecret),
        {
          guilds: expect.any(Array),
          guildsRefreshedAt: now,
        },
      ],
    ]);
    expect(vi.mocked(database.store.update).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(oauthClient.getCurrentUserGuilds).mock.invocationCallOrder[0],
    );
    expect(database.store.delete).not.toHaveBeenCalled();
    expect(firstResult?.record.tokens.refreshToken).toBe('new-refresh');
    expect(secondResult?.record.tokens.refreshToken).toBe('new-refresh');
  });

  it('shares a transient refresh failure, retains the session, and retries later', async () => {
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
    expect(database.store.delete).not.toHaveBeenCalled();
    expect(database.read()?.tokens.refreshToken).toBe('old-refresh');

    vi.mocked(oauthClient.refreshToken).mockResolvedValueOnce(refreshedToken());
    await expect(service.resolve(rawId)).resolves.toMatchObject({
      record: { tokens: { refreshToken: 'new-refresh' } },
    });
    expect(oauthClient.refreshToken).toHaveBeenCalledTimes(2);
    expect(database.store.delete).not.toHaveBeenCalled();
  });

  it('keeps a rotated token when guild lookup fails and retries claims without rotating again', async () => {
    const database = createStore(session());
    const oauthClient = createOAuthClient();
    vi.mocked(oauthClient.refreshToken).mockResolvedValue(refreshedToken());
    const failure = new Error('Discord guild lookup failed');
    vi.mocked(oauthClient.getCurrentUserGuilds).mockImplementationOnce(async accessToken => {
      expect(accessToken).toBe('new-access');
      expect(database.read()?.tokens.refreshToken).toBe('new-refresh');
      throw failure;
    });
    const service = new PersistentAuthSessionService(database.store, oauthClient, () => now);

    await expect(service.resolve(rawId)).rejects.toBe(failure);
    expect(database.read()?.tokens.refreshToken).toBe('new-refresh');
    expect(database.store.update).toHaveBeenCalledExactlyOnceWith(
      sessionKey(rawId, environment.sessionSecret),
      { tokens: expect.objectContaining({ refreshToken: 'new-refresh' }) },
    );
    expect(database.store.delete).not.toHaveBeenCalled();

    await expect(service.resolve(rawId)).resolves.toMatchObject({
      record: { guilds: [{ id: 'guild' }], tokens: { refreshToken: 'new-refresh' } },
    });
    expect(oauthClient.refreshToken).toHaveBeenCalledOnce();
    expect(oauthClient.getCurrentUserGuilds).toHaveBeenCalledTimes(2);
  });

  it('retains a valid session when only its guild claims refresh fails', async () => {
    const record = session();
    record.tokens.expiresAt = new Date('2026-09-22T09:00:00.000Z');
    const database = createStore(record);
    const oauthClient = createOAuthClient();
    const failure = new Error('Discord guild lookup unavailable');
    vi.mocked(oauthClient.getCurrentUserGuilds).mockRejectedValueOnce(failure);
    const service = new PersistentAuthSessionService(database.store, oauthClient, () => now);

    await expect(service.resolve(rawId)).rejects.toBe(failure);
    expect(database.read()?.tokens.refreshToken).toBe('old-refresh');
    expect(database.store.delete).not.toHaveBeenCalled();
    expect(database.store.update).not.toHaveBeenCalled();

    await expect(service.resolve(rawId)).resolves.toMatchObject({
      record: { guilds: [{ id: 'guild' }] },
    });
    expect(oauthClient.refreshToken).not.toHaveBeenCalled();
  });

  it.each(['rejected write', 'unmatched write'] as const)(
    'requires reauthentication if the rotated token has a %s',
    async failureMode => {
      const database = createStore(session());
      const oauthClient = createOAuthClient();
      vi.mocked(oauthClient.refreshToken).mockResolvedValue(refreshedToken());
      if (failureMode === 'rejected write') {
        vi.mocked(database.store.update).mockRejectedValueOnce(
          new Error('mongodb://private.example/secret?password=unsafe old-access old-refresh'),
        );
      } else {
        vi.mocked(database.store.update).mockResolvedValueOnce(false);
      }
      const service = new PersistentAuthSessionService(database.store, oauthClient, () => now);

      await expect(service.resolve(rawId)).rejects.toThrow(SessionReauthenticationRequiredError);
      expect(database.read()?.tokens.refreshToken).toBe('old-refresh');
      expect(oauthClient.getCurrentUserGuilds).not.toHaveBeenCalled();
      expect(database.store.delete).not.toHaveBeenCalled();
      expect(database.store.renew).not.toHaveBeenCalled();
      expect(logs.error).toHaveBeenCalledExactlyOnceWith(
        failureMode === 'rejected write'
          ? 'Failed to persist refreshed Discord credentials: database write failed'
          : 'Failed to persist refreshed Discord credentials: session record missing',
      );
      const logged = JSON.stringify(logs.error.mock.calls);
      for (const secret of [
        'mongodb://',
        'old-access',
        'old-refresh',
        'new-access',
        'new-refresh',
        rawId,
        sessionKey(rawId, environment.sessionSecret),
      ]) {
        expect(logged).not.toContain(secret);
      }
    },
  );

  it('shares a token-save failure across concurrent resolves and clears the flight', async () => {
    let failWrite!: (error: Error) => void;
    const write = new Promise<boolean>((_resolve, reject) => {
      failWrite = reject;
    });
    const database = createStore(session());
    vi.mocked(database.store.update).mockReturnValueOnce(write);
    const oauthClient = createOAuthClient();
    vi.mocked(oauthClient.refreshToken)
      .mockResolvedValueOnce(refreshedToken())
      .mockRejectedValueOnce(new Error('rotated token no longer works'));
    const service = new PersistentAuthSessionService(database.store, oauthClient, () => now);

    const first = service.resolve(rawId);
    await vi.waitFor(() => expect(database.store.update).toHaveBeenCalledOnce());
    const second = service.resolve(rawId);
    await vi.waitFor(() => expect(database.store.get).toHaveBeenCalledTimes(3));
    failWrite(new Error('database unavailable'));

    const results = await Promise.allSettled([first, second]);
    expect(
      results.every(
        result =>
          result.status === 'rejected' &&
          result.reason instanceof SessionReauthenticationRequiredError,
      ),
    ).toBe(true);
    expect(oauthClient.refreshToken).toHaveBeenCalledOnce();
    expect(oauthClient.getCurrentUserGuilds).not.toHaveBeenCalled();
    expect(database.store.delete).not.toHaveBeenCalled();

    await expect(service.resolve(rawId)).rejects.toThrow('rotated token no longer works');
    expect(oauthClient.refreshToken).toHaveBeenCalledTimes(2);
  });

  it.each(['rejected write', 'unmatched write'] as const)(
    'surfaces a %s for guild claims without deleting the saved token',
    async failureMode => {
      const database = createStore(session());
      const oauthClient = createOAuthClient();
      vi.mocked(oauthClient.refreshToken).mockResolvedValue(refreshedToken());
      const saveToken = async (
        _id: string,
        values: Partial<Omit<SessionDTO, '_id'>>,
      ): Promise<boolean> => {
        database.set({ ...database.read()!, ...structuredClone(values) });
        return true;
      };
      if (failureMode === 'rejected write') {
        vi.mocked(database.store.update).mockImplementationOnce(saveToken);
        vi.mocked(database.store.update).mockRejectedValueOnce(new Error('database unavailable'));
      } else {
        vi.mocked(database.store.update).mockImplementationOnce(saveToken);
        vi.mocked(database.store.update).mockResolvedValueOnce(false);
      }
      const service = new PersistentAuthSessionService(database.store, oauthClient, () => now);

      await expect(service.resolve(rawId)).rejects.toThrow(
        failureMode === 'rejected write'
          ? 'database unavailable'
          : 'Failed to save Discord guild claims',
      );
      expect(database.read()?.tokens.refreshToken).toBe('new-refresh');
      expect(database.store.delete).not.toHaveBeenCalled();
      expect(database.store.renew).not.toHaveBeenCalled();

      await expect(service.resolve(rawId)).resolves.toMatchObject({
        record: { guilds: [{ id: 'guild' }], tokens: { refreshToken: 'new-refresh' } },
      });
      expect(oauthClient.refreshToken).toHaveBeenCalledOnce();
      expect(oauthClient.getCurrentUserGuilds).toHaveBeenCalledTimes(2);
    },
  );

  it('shares a claim-refresh failure and retries after the in-flight work clears', async () => {
    let failClaims!: (error: Error) => void;
    const claims = new Promise<SessionDTO['guilds']>((_resolve, reject) => {
      failClaims = reject;
    });
    const database = createStore(session());
    const oauthClient = createOAuthClient();
    vi.mocked(oauthClient.refreshToken).mockResolvedValue(refreshedToken());
    vi.mocked(oauthClient.getCurrentUserGuilds).mockReturnValueOnce(claims);
    const service = new PersistentAuthSessionService(database.store, oauthClient, () => now);

    const first = service.resolve(rawId);
    await vi.waitFor(() => expect(oauthClient.getCurrentUserGuilds).toHaveBeenCalledOnce());
    expect(database.read()?.tokens.refreshToken).toBe('new-refresh');
    const second = service.resolve(rawId);
    await vi.waitFor(() => expect(database.store.get).toHaveBeenCalledTimes(3));
    failClaims(new Error('temporary guild failure'));

    const results = await Promise.allSettled([first, second]);
    expect(results.map(result => result.status)).toEqual(['rejected', 'rejected']);
    expect(oauthClient.refreshToken).toHaveBeenCalledOnce();
    expect(oauthClient.getCurrentUserGuilds).toHaveBeenCalledOnce();
    expect(database.store.delete).not.toHaveBeenCalled();

    await expect(service.resolve(rawId)).resolves.toMatchObject({
      record: { guilds: [{ id: 'guild' }] },
    });
    expect(oauthClient.refreshToken).toHaveBeenCalledOnce();
    expect(oauthClient.getCurrentUserGuilds).toHaveBeenCalledTimes(2);
  });
});
