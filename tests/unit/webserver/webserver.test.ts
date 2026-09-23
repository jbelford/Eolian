import { TrackSource } from '@eolian/api/@types';
import { GITHUB_PAGE } from '@eolian/common/constants';
import { FeatureFlag } from '@eolian/data/@types';
import { AppDatabase } from '@eolian/data/@types';
import { IAuthServiceProvider } from '@eolian/framework/@types';
import { createWebServerInstance, WebServer } from '@eolian/webserver';
import { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enabledFlags: new Set<FeatureFlag>(),
  info: vi.fn(),
}));

vi.mock('@eolian/data', () => ({
  feature: { enabled: vi.fn((flag: FeatureFlag) => mocks.enabledFlags.has(flag)) },
}));

vi.mock('@eolian/common/logger', () => ({
  logger: { info: mocks.info },
}));

function createAuthProviders() {
  const spotify = { callback: vi.fn() };
  const soundcloud = { callback: vi.fn() };
  return {
    spotify,
    soundcloud,
    provider: {
      getService: vi.fn((source: TrackSource) =>
        source === TrackSource.Spotify ? spotify : soundcloud,
      ),
    } as unknown as IAuthServiceProvider,
  };
}

function createDatabase(): AppDatabase {
  return {
    users: {} as AppDatabase['users'],
    servers: {} as AppDatabase['servers'],
    close: vi.fn().mockResolvedValue(undefined),
  };
}

describe('web server routes', () => {
  beforeEach(() => {
    mocks.enabledFlags.clear();
  });

  it('exposes the health check and temporary root redirect', async () => {
    const { provider } = createAuthProviders();
    const server = createWebServerInstance(provider, createDatabase());

    const health = await server.inject({ method: 'GET', url: '/healthz' });
    const root = await server.inject({ method: 'GET', url: '/' });
    await server.close();

    expect(health.statusCode).toBe(200);
    expect(health.body).toBe('OK');
    expect(health.headers['content-type']).toContain('text/plain');
    expect(root.statusCode).toBe(302);
    expect(root.headers.location).toBe(GITHUB_PAGE);
  });

  it('registers only enabled auth callbacks', async () => {
    mocks.enabledFlags.add(FeatureFlag.SPOTIFY_AUTH);
    const { provider } = createAuthProviders();
    const server = createWebServerInstance(provider, createDatabase());

    const spotify = await server.inject({
      method: 'GET',
      url: '/callback/spotify?state=state',
    });
    const soundcloud = await server.inject({
      method: 'GET',
      url: '/callback/soundcloud?state=state',
    });
    await server.close();

    expect(spotify.statusCode).toBe(400);
    expect(soundcloud.statusCode).toBe(404);
  });

  it.each(['/callback/spotify', '/callback/spotify?state='])(
    'rejects an invalid callback without invoking the auth service: %s',
    async url => {
      mocks.enabledFlags.add(FeatureFlag.SPOTIFY_AUTH);
      const { provider, spotify } = createAuthProviders();
      const server = createWebServerInstance(provider, createDatabase());

      const response = await server.inject({ method: 'GET', url });
      await server.close();

      expect(response.statusCode).toBe(400);
      expect(response.body).toBe('Missing state query param!');
      expect(spotify.callback).not.toHaveBeenCalled();
    },
  );

  it.each([
    [true, 200, 'Authenticated! You may close this window.'],
    [false, 400, 'Failed to authorize! Try again with a new link.'],
  ])('handles callback success=%s', async (success, statusCode, expected) => {
    mocks.enabledFlags.add(FeatureFlag.SOUNDCLOUD_AUTH);
    const { provider, soundcloud } = createAuthProviders();
    soundcloud.callback.mockResolvedValueOnce(success);
    const server = createWebServerInstance(provider, createDatabase());

    const response = await server.inject({
      method: 'GET',
      url: '/callback/soundcloud?state=state&code=code&error=error',
    });
    await server.close();

    expect(soundcloud.callback).toHaveBeenCalledWith({
      state: 'state',
      code: 'code',
      err: 'error',
    });
    expect(response.statusCode).toBe(statusCode);
    expect(response.body).toBe(expected);
  });
});

describe('WebServer lifecycle', () => {
  function createServer() {
    const { provider } = createAuthProviders();
    const listen = vi.fn<() => Promise<string>>();
    const close = vi.fn<() => Promise<void>>();
    const instance = {
      listen,
      close,
    } as unknown as FastifyInstance;
    return {
      close,
      listen,
      server: new WebServer(9876, provider, createDatabase(), instance),
    };
  }

  it('starts listening on all interfaces and logs when ready', async () => {
    const { listen, server } = createServer();
    listen.mockResolvedValue('http://0.0.0.0:9876');

    await server.start();

    expect(listen).toHaveBeenCalledWith({ port: 9876, host: '0.0.0.0' });
    expect(mocks.info).toHaveBeenCalledWith('App listening on port %d', 9876);
  });

  it('propagates listen failures', async () => {
    const { listen, server } = createServer();
    const error = new Error('address in use');
    listen.mockRejectedValue(error);

    await expect(server.start()).rejects.toBe(error);
  });

  it('closes a started server and does nothing before start', async () => {
    const { close, listen, server } = createServer();
    listen.mockResolvedValue('http://0.0.0.0:9876');
    close.mockResolvedValue();

    await server.close();
    expect(close).not.toHaveBeenCalled();

    await server.start();
    await server.close();

    expect(close).toHaveBeenCalledOnce();
  });

  it('propagates close failures', async () => {
    const { close, listen, server } = createServer();
    const error = new Error('close failed');
    listen.mockResolvedValue('http://0.0.0.0:9876');
    close.mockRejectedValue(error);

    await server.start();

    await expect(server.close()).rejects.toBe(error);
  });
});
