import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthSession } from '../../web/api/auth';
import { getAccountSettings, getGuild, getGuilds, startProviderLink } from '../../web/api/settings';
import { ApiError } from '../../web/api/client';
import { installFetchMock, jsonResponse, queueJson, queueResponse } from './fetch-mock';

const validSession = {
  authenticated: true,
  user: {
    id: '500',
    username: 'music-admin',
    globalName: 'Music Admin',
    avatar: null,
  },
  guilds: [
    {
      id: '100',
      name: 'Listening Room',
      icon: null,
      owner: true,
      permissions: '32',
    },
  ],
  csrfToken: 'csrf-secret',
  expiresAt: '2099-01-01T00:00:00.000Z',
};

const validAccount = {
  syntax: 'keyword',
  providers: {
    spotify: { linked: false, linkAvailable: true },
    soundcloud: { linked: true, linkAvailable: true },
  },
};

const validGuild = {
  id: '100',
  name: 'Listening Room',
  icon: null,
  memberCount: 42,
  settings: {
    prefix: '!',
    volume: 0.25,
    syntax: 'keyword',
    preferredChannelId: '300',
    djRoleIds: ['200'],
    djAllowLimited: false,
  },
  channels: [{ id: '300', name: 'music' }],
  roles: [{ id: '200', name: 'DJ' }],
};

const expectInvalidResponse = async (request: Promise<unknown>, message: string) => {
  await expect(request).rejects.toMatchObject({
    name: 'ApiError',
    kind: 'invalid-response',
    message,
  });
};

describe('web API runtime contracts', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['missing authenticated fields', { authenticated: true }],
    ['extra unauthenticated fields', { authenticated: false, csrfToken: 'unexpected' }],
    [
      'malformed guild permissions',
      {
        ...validSession,
        guilds: [{ ...validSession.guilds[0], permissions: 32 }],
      },
    ],
  ])('rejects auth DTOs with %s', async (_scenario, body) => {
    const fetchMock = installFetchMock();
    queueJson(fetchMock, body);

    await expectInvalidResponse(
      getAuthSession(),
      'The Eolian API returned an invalid session response.',
    );
  });

  it.each([
    ['missing providers', { syntax: 'keyword' }],
    ['extra account field', { ...validAccount, unexpected: true }],
    [
      'malformed provider status',
      {
        ...validAccount,
        providers: {
          ...validAccount.providers,
          spotify: { linked: 'no', linkAvailable: true },
        },
      },
    ],
  ])('rejects account DTOs with %s', async (_scenario, body) => {
    const fetchMock = installFetchMock();
    queueJson(fetchMock, body);

    await expectInvalidResponse(
      getAccountSettings(),
      'The Eolian API returned invalid account settings.',
    );
  });

  it.each([
    ['missing settings', { ...validGuild, settings: undefined }],
    ['extra guild field', { ...validGuild, unexpected: true }],
    ['out-of-range volume', { ...validGuild, settings: { ...validGuild.settings, volume: 1.01 } }],
    [
      'duplicate role ids',
      { ...validGuild, settings: { ...validGuild.settings, djRoleIds: ['200', '200'] } },
    ],
    [
      'malformed channel option',
      { ...validGuild, channels: [{ id: 'not-a-discord-id', name: 'music' }] },
    ],
  ])('rejects guild DTOs with %s', async (_scenario, body) => {
    const fetchMock = installFetchMock();
    queueJson(fetchMock, body);

    await expectInvalidResponse(
      getGuild('100'),
      'The Eolian API returned invalid server settings.',
    );
  });

  it('rejects extra fields in guild list and provider authorization DTOs', async () => {
    const fetchMock = installFetchMock();
    queueJson(fetchMock, { guilds: [], extra: true });
    queueJson(
      fetchMock,
      {
        authorizationUrl: 'https://provider.example/authorize',
        extra: true,
      },
      { status: 201 },
    );

    await expectInvalidResponse(getGuilds(), 'The Eolian API returned an invalid server list.');
    await expectInvalidResponse(
      startProviderLink('spotify', 'csrf-secret'),
      'The Eolian API returned an invalid provider authorization.',
    );
  });

  it('distinguishes invalid content types from invalid JSON', async () => {
    const fetchMock = installFetchMock();
    queueResponse(
      fetchMock,
      new Response(JSON.stringify(validAccount), {
        status: 200,
        headers: { 'content-type': 'text/html' },
      }),
    );
    queueResponse(
      fetchMock,
      new Response('{', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(getAccountSettings()).rejects.toMatchObject({
      kind: 'unexpected-content-type',
      status: 200,
    });
    await expect(getAccountSettings()).rejects.toMatchObject({
      kind: 'invalid-json',
      status: 200,
    });
  });

  it('preserves stable API error codes while classifying transient statuses', async () => {
    const fetchMock = installFetchMock();
    queueResponse(
      fetchMock,
      jsonResponse(
        {
          error: {
            code: 'bot_not_ready',
            message: 'The bot is not ready.',
            ignored: 'forward-compatible error metadata',
          },
        },
        { status: 503 },
      ),
    );

    const error = await getGuilds().catch(caught => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      kind: 'server',
      status: 503,
      code: 'bot_not_ready',
      message: 'The bot is not ready.',
    });
  });
});
