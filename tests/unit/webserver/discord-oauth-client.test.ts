import { environment } from '@eolian/common/env';
import { UndiciDiscordOAuthClient } from '@eolian/webserver/auth/discord-oauth-client';
import { PermissionFlagsBits } from 'discord.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
}));

vi.mock('undici', () => ({
  request: mocks.request,
}));

function response(payload: unknown, statusCode = 200) {
  return {
    statusCode,
    body: {
      json: vi.fn().mockResolvedValue(payload),
      dump: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function guild(id: string, permissions = '0', owner = false) {
  return {
    id,
    name: `Guild ${id}`,
    icon: null,
    owner,
    permissions,
  };
}

describe('UndiciDiscordOAuthClient', () => {
  beforeEach(() => {
    environment.baseUri = 'https://eolian.example/base';
    environment.tokens.discord.clientId = 'discord-client';
    environment.tokens.discord.clientSecret = 'discord-secret';
  });

  it('builds the official authorization-code URL with the retained callback', () => {
    const client = new UndiciDiscordOAuthClient();

    const url = new URL(client.authorizationUrl('state-value'));

    expect(url.origin + url.pathname).toBe('https://discord.com/oauth2/authorize');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'discord-client',
      redirect_uri: 'https://eolian.example/api/auth/discord/callback',
      scope: 'identify guilds',
      state: 'state-value',
    });
  });

  it('exchanges a token without retaining the refresh credential', async () => {
    mocks.request.mockResolvedValueOnce(
      response({
        access_token: 'access',
        refresh_token: 'provider-refresh-secret',
        scope: 'identify guilds',
        expires_in: 604800,
      }),
    );
    const client = new UndiciDiscordOAuthClient();

    await expect(client.exchangeCode('code')).resolves.toEqual({
      accessToken: 'access',
      scope: 'identify guilds',
      expiresIn: 604800,
    });

    const credentials = Buffer.from('discord-client:discord-secret').toString('base64');
    expect(mocks.request).toHaveBeenNthCalledWith(
      1,
      'https://discord.com/api/v10/oauth2/token',
      expect.objectContaining({
        method: 'POST',
        headers: {
          authorization: `Basic ${credentials}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: 'code',
          redirect_uri: 'https://eolian.example/api/auth/discord/callback',
        }).toString(),
      }),
    );
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });

  it('returns only guilds the user can manage', async () => {
    mocks.request.mockResolvedValue(
      response([
        guild('1', '0', true),
        guild('2', PermissionFlagsBits.Administrator.toString()),
        guild('3', PermissionFlagsBits.ManageGuild.toString()),
        guild('4', PermissionFlagsBits.ViewChannel.toString()),
      ]),
    );
    const client = new UndiciDiscordOAuthClient();

    const guilds = await client.getCurrentUserGuilds('access');

    expect(guilds.map(value => value.id)).toEqual(['1', '2', '3']);
    expect(mocks.request).toHaveBeenCalledWith(
      'https://discord.com/api/v10/users/@me/guilds?limit=200',
      { headers: { authorization: 'Bearer access' } },
    );
  });

  it('paginates every guild page with an advancing after cursor', async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) =>
      guild((index + 1).toString(), '0', true),
    );
    const secondPage = [guild('201', PermissionFlagsBits.ManageGuild.toString())];
    mocks.request
      .mockResolvedValueOnce(response(firstPage))
      .mockResolvedValueOnce(response(secondPage));
    const client = new UndiciDiscordOAuthClient();

    const guilds = await client.getCurrentUserGuilds('access');

    expect(guilds).toHaveLength(201);
    expect(mocks.request).toHaveBeenNthCalledWith(
      1,
      'https://discord.com/api/v10/users/@me/guilds?limit=200',
      { headers: { authorization: 'Bearer access' } },
    );
    expect(mocks.request).toHaveBeenNthCalledWith(
      2,
      'https://discord.com/api/v10/users/@me/guilds?limit=200&after=200',
      { headers: { authorization: 'Bearer access' } },
    );
  });

  it.each([
    ['non-array page', { guilds: [] }],
    ['malformed guild', [guild('not-a-snowflake')]],
    ['oversized page', Array.from({ length: 201 }, (_, index) => guild((index + 1).toString()))],
  ])('rejects a %s response', async (_description, payload) => {
    mocks.request.mockResolvedValue(response(payload));
    const client = new UndiciDiscordOAuthClient();

    await expect(client.getCurrentUserGuilds('access')).rejects.toThrow(
      'Invalid Discord guild response',
    );
  });

  it('rejects a full page whose pagination cursor does not advance', async () => {
    const firstPage = Array.from({ length: 200 }, (_, index) => guild((index + 1).toString()));
    const repeatedCursorPage = Array.from({ length: 200 }, (_, index) =>
      guild(index === 199 ? '200' : (index + 201).toString()),
    );
    mocks.request
      .mockResolvedValueOnce(response(firstPage))
      .mockResolvedValueOnce(response(repeatedCursorPage));
    const client = new UndiciDiscordOAuthClient();

    await expect(client.getCurrentUserGuilds('access')).rejects.toThrow(
      'Discord guild pagination cursor did not advance',
    );
    expect(mocks.request).toHaveBeenCalledTimes(2);
  });

  it('rejects malformed provider responses without returning their contents', async () => {
    mocks.request.mockResolvedValue(response({ id: 'user-without-required-fields' }));
    const client = new UndiciDiscordOAuthClient();

    await expect(client.getCurrentUser('access')).rejects.toThrow('Invalid Discord user response');
  });
});
