import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TrackSource } from '@eolian/api/@types';
import { EolianUserError } from '@eolian/common/errors';

const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  createAuthEmbed: vi.fn(() => ({ title: 'authorize' })),
  createAuthCompleteEmbed: vi.fn(() => ({ title: 'complete' })),
  createAuthExpiredEmbed: vi.fn(() => ({ title: 'expired' })),
  createAuthErrorEmbed: vi.fn(() => ({ title: 'error' })),
}));

vi.mock('@eolian/common/logger', () => ({
  logger: { info: mocks.info, warn: mocks.warn },
}));

vi.mock('@eolian/embed', () => ({
  createAuthEmbed: mocks.createAuthEmbed,
  createAuthCompleteEmbed: mocks.createAuthCompleteEmbed,
  createAuthExpiredEmbed: mocks.createAuthExpiredEmbed,
  createAuthErrorEmbed: mocks.createAuthErrorEmbed,
}));

import { DiscordAuthorizationProvider } from '@eolian/framework/discord-authorization-provider';

function createSubject(response: Promise<unknown>) {
  const message = { editEmbed: vi.fn().mockResolvedValue(undefined) };
  const user = {
    id: 'user',
    setToken: vi.fn().mockResolvedValue(undefined),
    sendEmbed: vi.fn().mockResolvedValue(message),
  };
  const service = {
    authorize: vi.fn(() => ({ link: 'https://auth.test', response })),
  };
  const sendable = { send: vi.fn().mockResolvedValue(undefined) };
  const provider = new DiscordAuthorizationProvider(
    user as never,
    service as never,
    TrackSource.Spotify,
    sendable as never,
  );
  return { provider, user, service, sendable, message };
}

describe('DiscordAuthorizationProvider', () => {
  beforeEach(() => vi.clearAllMocks());

  it('persists the refresh token and edits the DM after successful authorization', async () => {
    const token = {
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600,
      scope: 'scope',
    };
    const { provider, user, service, sendable, message } = createSubject(Promise.resolve(token));

    await expect(provider.authorize()).resolves.toBe(token);

    expect(sendable.send).toHaveBeenCalledWith('Spotify authorization required! Check your DMs');
    expect(service.authorize).toHaveBeenCalledOnce();
    expect(mocks.createAuthEmbed).toHaveBeenCalledWith('https://auth.test', TrackSource.Spotify);
    expect(user.sendEmbed).toHaveBeenCalledWith({ title: 'authorize' });
    expect(user.setToken).toHaveBeenCalledWith('refresh', TrackSource.Spotify);
    expect(message.editEmbed).toHaveBeenCalledWith({ title: 'complete' });
  });

  it('reports a user-facing error when the authorization DM cannot be sent', async () => {
    const { provider, user } = createSubject(new Promise(() => undefined));
    user.sendEmbed.mockResolvedValueOnce(undefined);

    await expect(provider.authorize()).rejects.toThrow(
      'I failed to send Spotify authorization link to you via DM',
    );
  });

  it('edits the DM as expired after an authorization timeout', async () => {
    const { provider, user, message } = createSubject(Promise.reject('timeout'));

    await expect(provider.authorize()).rejects.toBeInstanceOf(EolianUserError);
    expect(message.editEmbed).toHaveBeenCalledWith({ title: 'expired' });
    expect(user.setToken).not.toHaveBeenCalled();
    expect(mocks.info).toHaveBeenCalledWith('[%s] %s authorization timed out', 'user', 'Spotify');
  });

  it('edits the DM as failed after other authorization errors', async () => {
    const error = new Error('denied');
    const { provider, message } = createSubject(Promise.reject(error));

    await expect(provider.authorize()).rejects.toThrow('Spotify authorization failed');
    expect(message.editEmbed).toHaveBeenCalledWith({ title: 'error' });
    expect(mocks.warn).toHaveBeenCalledWith(
      '[%s] %s failed to authorize: %s',
      'user',
      'Spotify',
      error,
    );
  });

  it('returns the token even if persistence or the completion edit fails', async () => {
    const token = {
      access_token: 'access',
      refresh_token: 'refresh',
      expires_in: 3600,
      scope: 'scope',
    };
    const { provider, user, message } = createSubject(Promise.resolve(token));
    user.setToken.mockRejectedValueOnce(new Error('database unavailable'));
    message.editEmbed.mockRejectedValueOnce(new Error('message deleted'));

    await expect(provider.authorize()).resolves.toBe(token);
  });
});
