import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const apps: {
    routes: Map<string, (req: unknown, res: unknown) => Promise<void> | void>;
    use: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    listen: ReturnType<typeof vi.fn>;
  }[] = [];
  const staticHandler = {};
  const staticFn = vi.fn(() => staticHandler);
  const express = vi.fn(() => {
    const routes = new Map();
    const app = {
      routes,
      use: vi.fn(),
      get: vi.fn((route, handler) => {
        routes.set(route, handler);
      }),
      listen: vi.fn(),
    };
    apps.push(app);
    return app;
  });
  return {
    apps,
    enabledFlags: new Set<number>(),
    express,
    staticFn,
    staticHandler,
    info: vi.fn(),
  };
});

vi.mock('express', () => ({
  default: Object.assign(mocks.express, { static: mocks.staticFn }),
}));

vi.mock('@eolian/data', () => ({
  feature: { enabled: vi.fn((flag: number) => mocks.enabledFlags.has(flag)) },
}));

vi.mock('@eolian/common/logger', () => ({
  logger: { info: mocks.info },
}));

import { TrackSource } from '@eolian/api/@types';
import { GITHUB_PAGE } from '@eolian/common/constants';
import { FeatureFlag } from '@eolian/data/@types';
import { WebServer } from '@eolian/framework/webserver';

function response() {
  const res = {
    render: vi.fn(),
    redirect: vi.fn(),
    send: vi.fn(),
    status: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

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
    },
  };
}

describe('WebServer', () => {
  beforeEach(() => {
    mocks.apps.length = 0;
    mocks.enabledFlags.clear();
  });

  it('serves the website and static assets when the website flag is enabled', () => {
    mocks.enabledFlags.add(FeatureFlag.WEBSITE);
    const { provider } = createAuthProviders();
    new WebServer(8080, provider as never);
    const app = mocks.apps[0];
    const res = response();

    app.routes.get('/')!({} as never, res as never);

    expect(mocks.staticFn).toHaveBeenCalledWith(expect.stringMatching(/framework\/public$/));
    expect(app.use).toHaveBeenCalledWith(mocks.staticHandler);
    expect(res.render).toHaveBeenCalledWith('index.html');
  });

  it('redirects to GitHub when the website flag is disabled', () => {
    const { provider } = createAuthProviders();
    new WebServer(8080, provider as never);
    const res = response();

    mocks.apps[0].routes.get('/')!({} as never, res as never);

    expect(mocks.staticFn).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith(GITHUB_PAGE);
  });

  it('registers only enabled auth callbacks', () => {
    mocks.enabledFlags.add(FeatureFlag.SPOTIFY_AUTH);
    const { provider } = createAuthProviders();
    new WebServer(8080, provider as never);

    expect([...mocks.apps[0].routes.keys()]).toEqual(['/', '/callback/spotify']);
  });

  it('rejects callbacks without state without invoking the auth service', async () => {
    mocks.enabledFlags.add(FeatureFlag.SPOTIFY_AUTH);
    const { provider, spotify } = createAuthProviders();
    new WebServer(8080, provider as never);
    const res = response();

    await mocks.apps[0].routes.get('/callback/spotify')!(
      { query: { code: 'code' } } as never,
      res as never,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith('Missing state query param!');
    expect(spotify.callback).not.toHaveBeenCalled();
  });

  it.each([
    [true, 'Authenticated! You may close this window.'],
    [false, 'Failed to authorize! Try again with a new link.'],
  ])('handles callback success=%s', async (success, expected) => {
    mocks.enabledFlags.add(FeatureFlag.SOUNDCLOUD_AUTH);
    const { provider, soundcloud } = createAuthProviders();
    soundcloud.callback.mockResolvedValueOnce(success);
    new WebServer(8080, provider as never);
    const res = response();

    await mocks.apps[0].routes.get('/callback/soundcloud')!(
      { query: { state: 'state', code: 'code', error: 'error' } } as never,
      res as never,
    );

    expect(soundcloud.callback).toHaveBeenCalledWith({
      state: 'state',
      code: 'code',
      err: 'error',
    });
    expect(res.send).toHaveBeenCalledWith(expected);
    expect(res.status).toHaveBeenCalledTimes(success ? 0 : 1);
    if (!success) expect(res.status).toHaveBeenCalledWith(400);
  });

  it('starts listening and logs once the listener is ready', () => {
    const { provider } = createAuthProviders();
    const server = { listening: true, close: vi.fn() };
    const webserver = new WebServer(9876, provider as never);
    const currentApp = mocks.apps[0];
    currentApp.listen.mockImplementation((_port, callback) => {
      callback();
      return server;
    });
    webserver.start();

    expect(currentApp.listen).toHaveBeenCalledWith(9876, expect.any(Function));
    expect(mocks.info).toHaveBeenCalledWith('App listening on port %d', 9876);
  });

  it('propagates synchronous listen failures', () => {
    const { provider } = createAuthProviders();
    const webserver = new WebServer(8080, provider as never);
    mocks.apps[0].listen.mockImplementation(() => {
      throw new Error('address in use');
    });

    expect(() => webserver.start()).toThrow('address in use');
  });

  it('closes a listening server and resolves immediately before start', async () => {
    const { provider } = createAuthProviders();
    const webserver = new WebServer(8080, provider as never);
    await expect(webserver.close()).resolves.toBeUndefined();

    const server = {
      listening: true,
      close: vi.fn((callback: (error?: Error) => void) => callback()),
    };
    mocks.apps[0].listen.mockReturnValue(server);
    webserver.start();

    await expect(webserver.close()).resolves.toBeUndefined();
    expect(server.close).toHaveBeenCalledOnce();
  });

  it('rejects when the HTTP server fails to close', async () => {
    const { provider } = createAuthProviders();
    const webserver = new WebServer(8080, provider as never);
    const error = new Error('close failed');
    const server = {
      listening: true,
      close: vi.fn((callback: (error?: Error) => void) => callback(error)),
    };
    mocks.apps[0].listen.mockReturnValue(server);
    webserver.start();

    await expect(webserver.close()).rejects.toBe(error);
  });
});
