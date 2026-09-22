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

  it('exchanges and refreshes tokens with form encoding and HTTP Basic auth', async () => {
    mocks.request
      .mockResolvedValueOnce(
        response({
          access_token: 'access',
          refresh_token: 'refresh',
          scope: 'identify guilds',
          expires_in: 3600,
        }),
      )
      .mockResolvedValueOnce(
        response({
          access_token: 'next-access',
          refresh_token: 'next-refresh',
          scope: 'guilds identify',
          expires_in: 7200,
        }),
      );
    const client = new UndiciDiscordOAuthClient();

    await expect(client.exchangeCode('code')).resolves.toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      scope: 'identify guilds',
      expiresIn: 3600,
    });
    await expect(client.refreshToken('refresh')).resolves.toEqual({
      accessToken: 'next-access',
      refreshToken: 'next-refresh',
      scope: 'guilds identify',
      expiresIn: 7200,
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
    expect(mocks.request).toHaveBeenNthCalledWith(
      2,
      'https://discord.com/api/v10/oauth2/token',
      expect.objectContaining({
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: 'refresh',
        }).toString(),
      }),
    );
  });

  it('returns only guilds the user can manage', async () => {
    mocks.request.mockResolvedValue(
      response([
        {
          id: 'owner',
          name: 'Owned',
          icon: null,
          owner: true,
          permissions: '0',
        },
        {
          id: 'admin',
          name: 'Admin',
          icon: 'icon',
          owner: false,
          permissions: PermissionFlagsBits.Administrator.toString(),
        },
        {
          id: 'manager',
          name: 'Manager',
          icon: null,
          owner: false,
          permissions: PermissionFlagsBits.ManageGuild.toString(),
        },
        {
          id: 'member',
          name: 'Member',
          icon: null,
          owner: false,
          permissions: PermissionFlagsBits.ViewChannel.toString(),
        },
      ]),
    );
    const client = new UndiciDiscordOAuthClient();

    const guilds = await client.getCurrentUserGuilds('access');

    expect(guilds.map(guild => guild.id)).toEqual(['owner', 'admin', 'manager']);
    expect(mocks.request).toHaveBeenCalledWith('https://discord.com/api/v10/users/@me/guilds', {
      headers: { authorization: 'Bearer access' },
    });
  });

  it('rejects malformed provider responses without returning their contents', async () => {
    mocks.request.mockResolvedValue(response({ id: 'user-without-required-fields' }));
    const client = new UndiciDiscordOAuthClient();

    await expect(client.getCurrentUser('access')).rejects.toThrow('Invalid Discord user response');
  });
});
