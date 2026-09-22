import { environment } from '@eolian/common/env';
import { PermissionFlagsBits } from 'discord.js';
import { request } from 'undici';
import { DiscordOAuthClient, DiscordTokenResponse } from './@types';

const DISCORD_API = 'https://discord.com/api/v10';
const DISCORD_AUTHORIZE = 'https://discord.com/oauth2/authorize';
const DISCORD_SCOPES = 'identify guilds';

interface DiscordTokenPayload {
  access_token?: unknown;
  refresh_token?: unknown;
  scope?: unknown;
  expires_in?: unknown;
}

interface DiscordUserPayload {
  id?: unknown;
  username?: unknown;
  global_name?: unknown;
  avatar?: unknown;
}

interface DiscordGuildPayload {
  id?: unknown;
  name?: unknown;
  icon?: unknown;
  owner?: unknown;
  permissions?: unknown;
}

function callbackUrl(): string {
  return new URL('/api/auth/discord/callback', environment.baseUri).toString();
}

function clientId(): string {
  const value = environment.tokens.discord.clientId;
  if (!value) {
    throw new Error('Discord client ID is unavailable');
  }
  return value;
}

function parseToken(payload: DiscordTokenPayload): DiscordTokenResponse {
  if (
    typeof payload.access_token !== 'string' ||
    typeof payload.refresh_token !== 'string' ||
    typeof payload.scope !== 'string' ||
    typeof payload.expires_in !== 'number'
  ) {
    throw new Error('Invalid Discord token response');
  }
  const scopes = new Set(payload.scope.split(' '));
  if (!scopes.has('identify') || !scopes.has('guilds')) {
    throw new Error('Discord token response is missing required scopes');
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    scope: payload.scope,
    expiresIn: payload.expires_in,
  };
}

async function readJson<T>(response: Awaited<ReturnType<typeof request>>): Promise<T> {
  if (response.statusCode < 200 || response.statusCode >= 300) {
    await response.body.dump();
    throw new Error(`Discord request failed with status ${response.statusCode}`);
  }
  return (await response.body.json()) as T;
}

export class UndiciDiscordOAuthClient implements DiscordOAuthClient {
  authorizationUrl(state: string): string {
    const url = new URL(DISCORD_AUTHORIZE);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: clientId(),
      redirect_uri: callbackUrl(),
      scope: DISCORD_SCOPES,
      state,
    }).toString();
    return url.toString();
  }

  async exchangeCode(code: string): Promise<DiscordTokenResponse> {
    return this.requestToken({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callbackUrl(),
    });
  }

  async refreshToken(refreshToken: string): Promise<DiscordTokenResponse> {
    return this.requestToken({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  async getCurrentUser(accessToken: string) {
    const response = await request(`${DISCORD_API}/users/@me`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const payload = await readJson<DiscordUserPayload>(response);
    if (
      typeof payload.id !== 'string' ||
      typeof payload.username !== 'string' ||
      (payload.global_name !== null && typeof payload.global_name !== 'string') ||
      (payload.avatar !== null && typeof payload.avatar !== 'string')
    ) {
      throw new Error('Invalid Discord user response');
    }
    return {
      id: payload.id,
      username: payload.username,
      globalName: payload.global_name,
      avatar: payload.avatar,
    };
  }

  async getCurrentUserGuilds(accessToken: string) {
    const response = await request(`${DISCORD_API}/users/@me/guilds`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const payload = await readJson<DiscordGuildPayload[]>(response);
    if (!Array.isArray(payload)) {
      throw new Error('Invalid Discord guild response');
    }
    return payload
      .map(guild => {
        if (
          typeof guild.id !== 'string' ||
          typeof guild.name !== 'string' ||
          (guild.icon !== null && typeof guild.icon !== 'string') ||
          typeof guild.owner !== 'boolean' ||
          typeof guild.permissions !== 'string'
        ) {
          throw new Error('Invalid Discord guild response');
        }
        return {
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          owner: guild.owner,
          permissions: guild.permissions,
        };
      })
      .filter(guild => {
        const permissions = BigInt(guild.permissions);
        return (
          guild.owner ||
          (permissions & PermissionFlagsBits.Administrator) !== 0n ||
          (permissions & PermissionFlagsBits.ManageGuild) !== 0n
        );
      });
  }

  private async requestToken(form: Record<string, string>): Promise<DiscordTokenResponse> {
    const credentials = Buffer.from(
      `${clientId()}:${environment.tokens.discord.clientSecret}`,
    ).toString('base64');
    const response = await request(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${credentials}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(form).toString(),
    });
    return parseToken(await readJson<DiscordTokenPayload>(response));
  }
}
