import { beforeEach, describe, expect, it, vi } from 'vitest';

const { httpRequest, MockHttpRequestError } = vi.hoisted(() => ({
  httpRequest: vi.fn(),
  MockHttpRequestError: class extends Error {
    constructor(
      readonly statusCode: number,
      readonly body: unknown,
    ) {
      super(`HTTP ${statusCode}`);
    }
  },
}));
vi.mock('@eolian/http/request', async importOriginal => {
  const actual = await importOriginal<typeof import('@eolian/http/request')>();
  return { ...actual, httpRequest, HttpRequestError: MockHttpRequestError };
});
vi.mock('node:crypto', () => ({ randomUUID: () => 'state-id' }));
vi.mock('@eolian/common/util', async importOriginal => {
  const actual = await importOriginal<typeof import('@eolian/common/util')>();
  return { ...actual, promiseTimeout: (promise: Promise<unknown>) => promise };
});

import { AuthService } from '@eolian/http/auth-service';
import { AuthorizationCodeProvider } from '@eolian/http/authorization-code-provider';
import { ClientCredentialsProvider } from '@eolian/http/client-credentials-provider';
import { OAuthHttpClient } from '@eolian/http/oauth-http-client';

const token = (access: string, refresh?: string) => ({
  access_token: access,
  expires_in: 3600,
  scope: 'scope',
  ...(refresh ? { refresh_token: refresh } : {}),
});

describe('OAuth providers and client', () => {
  beforeEach(() => httpRequest.mockReset());

  it('uses client credentials initially, then a returned refresh token', async () => {
    httpRequest
      .mockResolvedValueOnce(token('first', 'refresh-one'))
      .mockResolvedValueOnce(token('second'));
    const provider = new ClientCredentialsProvider('API', '/token', { form: { client_id: 'id' } });

    await provider.getToken();
    await provider.getToken();

    expect(httpRequest.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      json: true,
      form: { client_id: 'id', grant_type: 'client_credentials' },
    });
    expect(httpRequest.mock.calls[1][1].form).toEqual({
      client_id: 'id',
      grant_type: 'refresh_token',
      refresh_token: 'refresh-one',
    });
  });

  it('falls back to client credentials only for invalid refresh grants', async () => {
    httpRequest
      .mockResolvedValueOnce(token('first', 'bad-refresh'))
      .mockRejectedValueOnce(new MockHttpRequestError(400, { error: 'invalid_grant' }))
      .mockResolvedValueOnce(token('fallback'));
    const provider = new ClientCredentialsProvider('API', '/token', {});
    await provider.getToken();
    await expect(provider.getToken()).resolves.toMatchObject({ access_token: 'fallback' });
    expect(httpRequest.mock.calls[2][1].form.grant_type).toBe('client_credentials');
  });

  it('refreshes authorization-code tokens when a refresh token is available', async () => {
    const authorization = { authorize: vi.fn().mockResolvedValue(token('new', 'new-refresh')) };
    httpRequest.mockResolvedValue(token('refreshed', 'rotated-refresh'));
    const provider = new AuthorizationCodeProvider(
      'API',
      '/token',
      { form: { client_id: 'id' } },
      authorization,
      'old-refresh',
    );

    await expect(provider.getToken()).resolves.toMatchObject({ access_token: 'refreshed' });
    expect(authorization.authorize).not.toHaveBeenCalled();
    expect(httpRequest).toHaveBeenCalledWith(
      '/token',
      expect.objectContaining({
        form: { client_id: 'id', grant_type: 'refresh_token', refresh_token: 'old-refresh' },
      }),
    );
  });

  it('starts authorization-code flow when no refresh token is available', async () => {
    const authorization = { authorize: vi.fn().mockResolvedValue(token('new', 'new-refresh')) };
    const provider = new AuthorizationCodeProvider('API', '/token', {}, authorization);
    await expect(provider.getToken()).resolves.toMatchObject({ access_token: 'new' });
    expect(authorization.authorize).toHaveBeenCalledOnce();
    expect(httpRequest).not.toHaveBeenCalled();
  });

  it('caches OAuth access tokens and retries invalid grants with a fresh token', async () => {
    const getToken = vi
      .fn()
      .mockResolvedValueOnce(token('access-one'))
      .mockResolvedValueOnce(token('access-two'));
    const client = new OAuthHttpClient('https://api.test', { name: 'API', getToken });
    httpRequest
      .mockRejectedValueOnce(new MockHttpRequestError(401, { error: 'invalid_grant' }))
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ cached: true });

    await expect(client.get('items', { limit: 2 })).resolves.toEqual({ ok: true });
    await expect(client.get('other')).resolves.toEqual({ cached: true });

    expect(getToken).toHaveBeenCalledTimes(2);
    expect(httpRequest.mock.calls[0]).toEqual([
      'https://api.test/items',
      { params: { limit: 2 }, json: true, auth: { bearer: 'access-one' } },
    ]);
    expect(httpRequest.mock.calls[1][1].auth.bearer).toBe('access-two');
    expect(httpRequest.mock.calls[2][1].auth.bearer).toBe('access-two');
  });

  it('builds authorization links and resolves callbacks through the cache', async () => {
    let cached:
      | { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }
      | undefined;
    const cache = {
      set: vi.fn((_key, value) => {
        cached = value;
        return Promise.resolve(true);
      }),
      get: vi.fn(() => Promise.resolve(cached)),
      del: vi.fn(() => Promise.resolve(true)),
    };
    httpRequest.mockResolvedValue(token('access', 'refresh'));
    const service = new AuthService(
      'API',
      'https://auth.test/authorize',
      'https://auth.test/token',
      { client_id: 'client', redirect_uri: 'https://app.test/callback', scope: 'read write' },
      { auth: { basic: { id: 'client', password: 'secret' } } },
      cache as never,
    );

    const result = service.authorize();
    expect(result.link).toBe(
      'https://auth.test/authorize?client_id=client&redirect_uri=https%3A%2F%2Fapp.test%2Fcallback&scope=read+write&response_type=code&state=state-id',
    );
    await expect(service.callback({ state: 'state-id', code: 'code-value' })).resolves.toBe(true);
    await expect(result.response).resolves.toMatchObject({ refresh_token: 'refresh' });
    expect(httpRequest.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      json: true,
      form: {
        grant_type: 'authorization_code',
        redirect_uri: 'https://app.test/callback',
        code: 'code-value',
      },
    });
    expect(cache.del).toHaveBeenCalledWith('state-id');
  });

  it('rejects missing callback codes and ignores unknown states', async () => {
    let cached:
      | { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }
      | undefined;
    const cache = {
      set: vi.fn((_key, value) => {
        cached = value;
        return Promise.resolve(true);
      }),
      get: vi.fn(() => Promise.resolve(cached)),
      del: vi.fn(() => Promise.resolve(true)),
    };
    const service = new AuthService(
      'API',
      '/authorize',
      '/token',
      { client_id: 'client', redirect_uri: '/callback' },
      {},
      cache as never,
    );
    const result = service.authorize();
    await expect(service.callback({ state: 'state-id' })).resolves.toBe(false);
    await expect(result.response).rejects.toBe('Missing authorization code!');

    cache.get.mockResolvedValueOnce(undefined);
    await expect(service.callback({ state: 'unknown', code: 'ignored' })).resolves.toBe(false);
  });
});
