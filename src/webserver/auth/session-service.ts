import { environment } from '@eolian/common/env';
import {
  DiscordSessionGuild,
  DiscordSessionUser,
  SessionDTO,
  SessionsDb,
} from '@eolian/data/@types';
import {
  GUILD_CLAIMS_MAX_AGE_MS,
  SESSION_DURATION_MS,
  SESSION_RENEW_INTERVAL_MS,
  TOKEN_REFRESH_LEEWAY_MS,
} from './constants';
import { randomToken, sessionKey } from './crypto';
import {
  AuthSession,
  AuthSessionService,
  DiscordOAuthClient,
  DiscordTokenResponse,
} from './@types';

export class PersistentAuthSessionService implements AuthSessionService {
  constructor(
    private readonly sessions: SessionsDb,
    private readonly oauthClient: DiscordOAuthClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async create(
    token: DiscordTokenResponse,
    user: DiscordSessionUser,
    guilds: DiscordSessionGuild[],
  ): Promise<AuthSession> {
    const now = this.now();
    const rawId = randomToken();
    const record: SessionDTO = {
      _id: sessionKey(rawId, environment.sessionSecret),
      user,
      tokens: this.tokenRecord(token, now),
      guilds,
      guildsRefreshedAt: now,
      csrfToken: randomToken(),
      createdAt: now,
      renewedAt: now,
      expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
    };
    await this.sessions.create(record);
    return { id: rawId, record, renewed: true };
  }

  async delete(rawId: string): Promise<boolean> {
    return this.sessions.delete(sessionKey(rawId, environment.sessionSecret));
  }

  async resolve(rawId: string): Promise<AuthSession | null> {
    const id = sessionKey(rawId, environment.sessionSecret);
    const record = await this.sessions.get(id);
    const now = this.now();
    if (!record) {
      return null;
    }
    if (record.expiresAt.getTime() <= now.getTime()) {
      await this.sessions.delete(id);
      return null;
    }

    let changed = false;
    if (record.tokens.expiresAt.getTime() <= now.getTime() + TOKEN_REFRESH_LEEWAY_MS) {
      try {
        const refreshed = await this.oauthClient.refreshToken(record.tokens.refreshToken);
        record.tokens = this.tokenRecord(refreshed, now);
        changed = true;
      } catch (error) {
        await this.sessions.delete(id);
        throw error;
      }
    }
    if (record.guildsRefreshedAt.getTime() <= now.getTime() - GUILD_CLAIMS_MAX_AGE_MS) {
      record.guilds = await this.oauthClient.getCurrentUserGuilds(record.tokens.accessToken);
      record.guildsRefreshedAt = now;
      changed = true;
    }
    if (changed) {
      await this.sessions.update(id, {
        tokens: record.tokens,
        guilds: record.guilds,
        guildsRefreshedAt: record.guildsRefreshedAt,
      });
    }

    const renewedAt = new Date(now.getTime() - SESSION_RENEW_INTERVAL_MS);
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
    const renewed = await this.sessions.renew(id, renewedAt, now, expiresAt);
    if (renewed) {
      record.renewedAt = now;
      record.expiresAt = expiresAt;
    }
    return { id: rawId, record, renewed };
  }

  private tokenRecord(token: DiscordTokenResponse, now: Date): SessionDTO['tokens'] {
    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      scope: token.scope,
      expiresAt: new Date(now.getTime() + token.expiresIn * 1000),
    };
  }
}
