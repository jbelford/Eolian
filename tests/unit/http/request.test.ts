import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Readable } from 'node:stream';

const { request, proxyAgent, compose, setGlobalDispatcher } = vi.hoisted(() => ({
  request: vi.fn(),
  proxyAgent: vi.fn(function (this: { options: unknown }, options: unknown) {
    this.options = options;
  }),
  compose: vi.fn(() => ({ dispatcher: true })),
  setGlobalDispatcher: vi.fn(),
}));

vi.mock('undici', () => ({
  request,
  EnvHttpProxyAgent: proxyAgent,
  getGlobalDispatcher: () => ({ compose }),
  setGlobalDispatcher,
  interceptors: {
    redirect: vi.fn(() => 'redirect'),
    retry: vi.fn(() => 'retry'),
  },
}));

import { HttpRequestError, httpRequest, querystringify } from '@eolian/http/request';

function response(statusCode: number, body: unknown, contentType = 'application/json') {
  return {
    statusCode,
    headers: { 'content-type': contentType },
    body: {
      json: vi.fn().mockResolvedValue(body),
      text: vi.fn().mockResolvedValue(String(body)),
    },
  };
}

describe('httpRequest', () => {
  beforeEach(() => request.mockReset());

  it('encodes query parameters and JSON responses', async () => {
    request.mockResolvedValue(response(200, { ok: true }));

    await expect(
      httpRequest('https://example.test/items', {
        params: { query: 'a & b', limit: 2, enabled: true },
        json: true,
      }),
    ).resolves.toEqual({ ok: true });

    expect(request).toHaveBeenCalledWith(
      'https://example.test/items?query=a+%26+b&limit=2&enabled=true',
      expect.objectContaining({ method: 'GET', body: undefined }),
    );
  });

  it('sets basic and bearer authorization headers without mutating unrelated values', async () => {
    request.mockResolvedValue(response(200, {}));
    const basicHeaders = { accept: 'application/json' };
    await httpRequest('https://example.test', {
      auth: { basic: { id: 'client', password: 'secret' } },
      headers: basicHeaders,
      json: true,
    });
    expect(request.mock.calls[0][1].headers).toEqual({
      accept: 'application/json',
      authorization: `Basic ${Buffer.from('client:secret').toString('base64')}`,
    });

    await httpRequest('https://example.test', {
      auth: { bearer: 'access-token' },
      json: true,
    });
    expect(request.mock.calls[1][1].headers.authorization).toBe('Bearer access-token');
  });

  it('form-encodes POST bodies and creates a proxy dispatcher', async () => {
    request.mockResolvedValue(response(200, {}));
    await httpRequest('https://example.test/token', {
      method: 'POST',
      form: { grant_type: 'refresh_token', refresh_token: 'a+b' },
      proxy: 'http://proxy.test',
      json: true,
    });

    expect(request).toHaveBeenCalledWith(
      'https://example.test/token',
      expect.objectContaining({
        method: 'POST',
        body: 'grant_type=refresh_token&refresh_token=a%2Bb',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        dispatcher: expect.anything(),
      }),
    );
    expect(proxyAgent).toHaveBeenCalledWith({ httpProxy: 'http://proxy.test' });
  });

  it('returns the response stream when JSON is disabled', async () => {
    const stream = Readable.from('audio');
    request.mockResolvedValue({ statusCode: 200, headers: {}, body: stream });
    await expect(httpRequest('https://example.test/audio')).resolves.toBe(stream);
  });

  it.each([
    ['application/json', { error: 'invalid_grant' }],
    ['text/plain', 'upstream failed'],
  ])('throws structured errors for %s failures', async (contentType, body) => {
    request.mockResolvedValue(response(401, body, contentType));
    const error = await httpRequest('https://example.test', { json: true }).catch(value => value);
    expect(error).toBeInstanceOf(HttpRequestError);
    expect(error).toMatchObject({ statusCode: 401, body });
  });

  it('serializes supported parameter values', () => {
    expect(querystringify({ text: 'hello world', count: 0, active: false })).toBe(
      'text=hello+world&count=0&active=false',
    );
  });
});
