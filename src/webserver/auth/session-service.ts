import { DiscordSessionUser } from '@eolian/data/@types';
import { FastifyInstance } from 'fastify';
import {
  AuthSession,
  AuthSessionService,
  DiscordOAuthClient,
  DiscordTokenResponse,
} from './@types';
import { SESSION_DURATION_SECONDS } from './constants';
import { randomToken } from './crypto';

interface SessionClaims {
  accessToken: string;
  user: DiscordSessionUser;
  csrfToken: string;
}

declare module '@fastify/secure-session' {
  interface SessionData {
    claims: SessionClaims;
  }
}

export class StatelessAuthSessionService implements AuthSessionService {
  constructor(
    private readonly server: FastifyInstance,
    private readonly oauthClient: DiscordOAuthClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  create(
    token: DiscordTokenResponse,
    user: DiscordSessionUser,
    tokenIssuedAt: Date,
  ): { cookie: string; expiresAt: Date } {
    const session = this.server.createSecureSession({
      claims: { accessToken: token.accessToken, user, csrfToken: randomToken() },
    });
    const timestamp: unknown = session.get('__ts');
    if (typeof timestamp !== 'number' || !Number.isSafeInteger(timestamp)) {
      throw new Error('Invalid secure-session timestamp');
    }
    const expiresAt = new Date((timestamp + SESSION_DURATION_SECONDS) * 1000);
    if (
      !token.accessToken ||
      !Number.isFinite(token.expiresIn) ||
      tokenIssuedAt.getTime() + token.expiresIn * 1000 < expiresAt.getTime()
    ) {
      throw new Error('Discord access token cannot support the session lifetime');
    }
    return { cookie: this.server.encodeSecureSession(session), expiresAt };
  }

  async resolve(cookie: string): Promise<AuthSession | null> {
    const session = this.read(cookie);
    if (!session) {
      return null;
    }
    const guilds = await this.oauthClient.getCurrentUserGuilds(session.claims.accessToken);
    return {
      id: cookie,
      record: {
        user: session.claims.user,
        guilds,
        csrfToken: session.claims.csrfToken,
        expiresAt: session.expiresAt,
      },
    };
  }

  async resolveForLogout(cookie: string): Promise<AuthSession | null> {
    const session = this.read(cookie);
    return session
      ? {
          id: cookie,
          record: {
            user: session.claims.user,
            guilds: [],
            csrfToken: session.claims.csrfToken,
            expiresAt: session.expiresAt,
          },
        }
      : null;
  }

  private read(cookie: string): { claims: SessionClaims; expiresAt: Date } | null {
    if (cookie.length > 4096) {
      return null;
    }
    try {
      const session = this.server.decodeSecureSession(cookie);
      const claims: unknown = session?.get('claims');
      const timestamp: unknown = session?.get('__ts');
      if (
        !isSessionClaims(claims) ||
        typeof timestamp !== 'number' ||
        !Number.isSafeInteger(timestamp)
      ) {
        return null;
      }
      const expiresAt = new Date((timestamp + SESSION_DURATION_SECONDS) * 1000);
      return this.now().getTime() < expiresAt.getTime() ? { claims, expiresAt } : null;
    } catch {
      return null;
    }
  }
}

function isSessionClaims(value: unknown): value is SessionClaims {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const claims = value as Partial<SessionClaims>;
  const user = claims.user;
  return (
    typeof claims.accessToken === 'string' &&
    claims.accessToken.length > 0 &&
    typeof claims.csrfToken === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(claims.csrfToken) &&
    typeof user === 'object' &&
    user !== null &&
    typeof user.id === 'string' &&
    typeof user.username === 'string' &&
    (user.globalName === null || typeof user.globalName === 'string') &&
    (user.avatar === null || typeof user.avatar === 'string')
  );
}
